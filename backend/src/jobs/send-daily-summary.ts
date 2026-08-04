import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"
import { getMerchantSettings } from "../lib/merchant-settings"
import { resolveAllRecipients } from "../lib/notify"

/**
 * The 07:05 daily summary (WorkflowPlan.md §15, D7).
 *
 * Content is deliberately three numbers and a link: yesterday's takings, how
 * many purchases were left unfinished, and a way into the admin. D7 rules out a
 * full order report on purpose — the orders themselves belong in Denní práce,
 * and a competing list in an inbox is how people end up working from two places.
 *
 * Goes to **both** notification addresses. If neither is configured it logs and
 * sends nothing, per D7's never-crash rule.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Payment states in which money has actually arrived (or is secured). */
const PAID_STATUSES = ["captured", "partially_captured"]

const ORDER_FIELDS = [
  "id",
  "created_at",
  "currency_code",
  // `total` is derived from the item projection — without `items.*` it is zero.
  "total",
  "items.*",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.refunded_amount",
]

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return toNumber(candidate.value ?? candidate.numeric_ ?? candidate.raw_ ?? 0)
  }
  return 0
}

export default async function sendDailySummary(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notifications = container.resolve(Modules.NOTIFICATION)

  const settings = await getMerchantSettings(container)
  if (!settings.daily_digest_enabled) {
    return
  }

  const recipients = resolveAllRecipients({
    dev: process.env.DEV_NOTIFICATION_EMAIL,
    owner: process.env.OWNER_NOTIFICATION_EMAIL,
  })

  if (!recipients.length) {
    logger.warn(
      "[digest] Denní souhrn se neodesílá: DEV_NOTIFICATION_EMAIL ani " +
        "OWNER_NOTIFICATION_EMAIL nejsou nastavené."
    )
    return
  }

  // Yesterday, in whole days — the job runs at 07:05 and reports the day that
  // just finished, not a rolling 24 hours.
  const now = new Date()
  const endOfWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  )
  const startOfWindow = new Date(endOfWindow.getTime() - DAY_MS)
  const day = startOfWindow.toISOString().slice(0, 10)

  // ---- Takings -------------------------------------------------------------
  // Orders come from the native list workflow because it is the only source of
  // the computed `payment_status`; a plain query.graph would not have it.
  const { result } = await getOrdersListWorkflow(container).run({
    input: {
      fields: ORDER_FIELDS,
      variables: {
        filters: {
          created_at: { $gte: startOfWindow, $lt: endOfWindow },
        },
      },
    },
  })
  const orders = Array.isArray(result) ? result : ((result as any)?.rows ?? [])

  const paidOrders = (orders as any[]).filter((order) =>
    PAID_STATUSES.includes(order.payment_status)
  )
  const revenue = paidOrders.reduce(
    (sum, order) => sum + toNumber(order.total),
    0
  )
  const currencyCode = String(
    paidOrders[0]?.currency_code || "czk"
  ).toUpperCase()

  // ---- Unfinished purchases: drafts + abandoned carts ----------------------
  const { data: draftOrders } = await query.graph({
    entity: "order",
    fields: ["id"],
    filters: { is_draft_order: true, status: "draft" },
  })

  // Same definition the abandoned-cart job uses: has an e-mail, has items, was
  // never completed, and has been untouched for a day.
  const { data: staleCarts } = await query.graph({
    entity: "cart",
    fields: ["id", "items.id"],
    filters: {
      updated_at: { $lt: new Date(now.getTime() - DAY_MS) },
      email: { $ne: null },
      completed_at: null,
    },
  })
  const abandonedCarts = (staleCarts as any[]).filter(
    (cart) => (cart.items || []).length > 0
  ).length

  const drafts = (draftOrders as any[]).length

  await notifications.createNotifications(
    recipients.map((to) => ({
      to,
      channel: "email",
      template: "merchant-daily-summary",
      // One digest per day per recipient, whatever happens to the schedule.
      idempotency_key: `mn:digest:${day}:${to}`,
      trigger_type: "digest",
      data: {
        subject: `Souhrn za ${startOfWindow.toLocaleDateString("cs-CZ")}`,
        date: startOfWindow.toLocaleDateString("cs-CZ"),
        revenue: new Intl.NumberFormat("cs-CZ", {
          style: "currency",
          currency: currencyCode,
        }).format(revenue),
        paid_orders: paidOrders.length,
        unfinished: {
          drafts,
          abandoned_carts: abandonedCarts,
          total: drafts + abandonedCarts,
        },
        admin_url:
          process.env.BACKEND_PUBLIC_URL || process.env.MEDUSA_BACKEND_URL || "",
      },
    })) as never
  )

  logger.info(
    `[digest] Denní souhrn za ${day} odeslán ${recipients.length} příjemci(ům): ` +
      `${paidOrders.length} zaplacených objednávek, ${drafts + abandonedCarts} nedokončených.`
  )
}

export const config = {
  name: "send-daily-summary",
  // 07:05 — after the 07:00 stock job, so a stock alert lands first.
  schedule: "5 7 * * *",
}
