import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getInventoryAlerts } from "../lib/inventory-alerts"
import { notifyMerchant } from "../lib/notify"

/**
 * The morning stock check (§3.9, §10, P7-2 — notifications #12 and #13).
 *
 * ## Why 07:00 and not on every inventory change
 *
 * Stock moves all day: an order reserves it, a fulfilment decrements it, a
 * cancellation puts it back. Alerting on the event would mean a stream of
 * notifications about a number that is still settling, several of them
 * contradicting each other by lunchtime.
 *
 * Once a day, before she starts, the question is answerable and worth
 * answering: what should I make more of today. That is a decision with a
 * natural daily rhythm, so the alert has one too.
 *
 * Deduped per item per day (`stock:{item}:{yyyy-mm-dd}`), so a restart or a
 * second run cannot repeat the morning's list.
 */

const DIGEST_LIMIT = 8

export default async function watchStockLevels(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { low, out, default_threshold } = await getInventoryAlerts(container)

  if (!low.length && !out.length) {
    return
  }

  const today = new Date().toISOString().slice(0, 10)

  // Sold out is the urgent half: those are listings customers can see and
  // cannot buy.
  for (const row of out.slice(0, DIGEST_LIMIT)) {
    await notifyMerchant(container, {
      key: `stock0:${row.variant_id}:${today}`,
      title: `Vyprodáno: ${row.product_title ?? "produkt"}`,
      description: `${row.variant_title ?? "varianta"} — zákazníci si to teď nemohou objednat.`,
      audience: "owner",
      resource: { id: row.product_id ?? row.variant_id, type: "product" },
    })
  }

  for (const row of low.slice(0, DIGEST_LIMIT)) {
    await notifyMerchant(container, {
      key: `stock:${row.variant_id}:${today}`,
      title: `Dochází: ${row.product_title ?? "produkt"}`,
      description: `${row.variant_title ?? "varianta"} — zbývá ${
        row.available
      } ks (hranice ${row.threshold}).`,
      audience: "owner",
      resource: { id: row.product_id ?? row.variant_id, type: "product" },
    })
  }

  // One digest e-mail rather than one per item — a dozen separate mails about
  // stock is how somebody starts ignoring stock mails.
  const lines = [
    out.length ? `Vyprodáno (${out.length}):` : null,
    ...out
      .slice(0, DIGEST_LIMIT)
      .map((row) => `• ${row.product_title} — ${row.variant_title}`),
    low.length ? `\nDochází (${low.length}), hranice ${default_threshold} ks:` : null,
    ...low
      .slice(0, DIGEST_LIMIT)
      .map(
        (row) =>
          `• ${row.product_title} — ${row.variant_title}: ${row.available} ks`
      ),
    out.length + low.length > DIGEST_LIMIT * 2
      ? "\nZbytek najdete v Přehledu → Sklad."
      : null,
  ].filter(Boolean)

  await notifyMerchant(container, {
    key: `stock-digest:${today}`,
    title: "Skladové upozornění",
    description: lines.join("\n"),
    audience: "owner",
    email: true,
  })

  logger.info(
    `[stock] ${out.length} vyprodaných, ${low.length} dochází — upozornění odesláno.`
  )
}

export const config = {
  name: "watch-stock-levels",
  schedule: "0 7 * * *",
}
