import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { updateSeasonalSelectionWorkflow } from "../workflows/manage-seasonal-selection"
import { notifyMerchant } from "../lib/notify"

/**
 * Closes seasonal sales that have run their course, and warns about ones about
 * to (§13, P9-4, plus the výprodej behaviour requested 2026-08-04).
 *
 * ## Why a finished sale cannot just be left alone
 *
 * The discount lives on a linked price list, and a price list with a past
 * `ends_at` stops applying on its own — but the *selection* keeps saying
 * „Aktivní" on the storefront and in the admin, and its products keep sitting
 * in a collection that is over. So the selection is archived here to match what
 * the prices are already doing.
 *
 * ## What happens to the products is a real decision
 *
 * A Christmas collection ends and the pieces go back to full price — they are
 * still perfectly good stock. A **výprodej** ends because the pieces are gone,
 * and leaving them published means listings nobody can buy.
 *
 * Those want opposite behaviour, so `on_end` decides per sale and nothing is
 * guessed. The default is `keep_selling`, the conservative direction: the worst
 * case is she hides something by hand, rather than the shop quietly hiding
 * stock she wanted to sell.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export default async function closeFinishedSales(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const now = Date.now()

  const { data: selections } = await query.graph({
    entity: "seasonal_selection",
    fields: [
      "id",
      "title",
      "publication_status",
      "starts_at",
      "ends_at",
      "on_end",
      "items.product_id",
    ],
  })

  for (const selection of selections as any[]) {
    if (selection.publication_status === "archived" || !selection.ends_at) {
      continue
    }

    const endsAt = new Date(selection.ends_at).getTime()
    if (!Number.isFinite(endsAt)) {
      continue
    }

    // ── Ending soon: notification #17, once per sale per day ───────────────
    if (endsAt > now) {
      const daysLeft = Math.ceil((endsAt - now) / DAY_MS)
      if (daysLeft <= 3 && selection.publication_status === "published") {
        await notifyMerchant(container, {
          key: `mn:saleend:${selection.id}:${new Date().toISOString().slice(0, 10)}`,
          title: `Akce „${selection.title}" končí za ${daysLeft} dní`,
          description:
            selection.on_end === "hide_products"
              ? "Až skončí, produkty z ní schováme z e-shopu."
              : "Až skončí, produkty se vrátí na běžnou cenu a zůstanou v prodeji.",
          audience: "owner",
        })
      }
      continue
    }

    // ── Finished ───────────────────────────────────────────────────────────
    await updateSeasonalSelectionWorkflow(container).run({
      input: { id: selection.id, publication_status: "archived" },
    })

    const productIds = (selection.items || [])
      .map((item: any) => item.product_id)
      .filter(Boolean)

    if (selection.on_end === "hide_products" && productIds.length) {
      // A výprodej is over because the pieces are gone.
      await updateProductsWorkflow(container).run({
        input: {
          selector: { id: productIds },
          update: { status: "draft" },
        },
      })
    }

    logger.info(
      `[sales] Akce „${selection.title}" skončila — archivována` +
        (selection.on_end === "hide_products"
          ? `, ${productIds.length} produktů skryto.`
          : ", produkty zůstávají v prodeji.")
    )

    await notifyMerchant(container, {
      key: `mn:saleclosed:${selection.id}`,
      title: `Akce „${selection.title}" skončila`,
      description:
        selection.on_end === "hide_products"
          ? `Produkty z výprodeje jsme schovali z e-shopu (${productIds.length}).`
          : "Produkty se vrátily na běžnou cenu a zůstávají v prodeji.",
      audience: "owner",
    })
  }
}

export const config = {
  name: "close-finished-sales",
  // Just after midnight: a sale that ended yesterday should be over when she
  // opens the admin in the morning, not halfway through the day.
  schedule: "10 0 * * *",
}
