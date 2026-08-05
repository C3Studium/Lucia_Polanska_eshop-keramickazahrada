import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"
import { resolveAllRecipients } from "../lib/notify"

/**
 * The Monday-morning weekly summary.
 *
 * The 07:05 daily digest is operational — what happened yesterday, what needs
 * attention today. This one is a balance sheet: how the finished week compares
 * to the one before it, and which objects actually sold. It answers the
 * question the daily numbers never add up to on their own.
 *
 * Same D7 rules as the daily digest: goes to both notification addresses,
 * logs and sends nothing when neither is configured, one send per week per
 * recipient whatever happens to the schedule.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

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

const sumRevenue = (orders: any[]): number =>
  orders.reduce((sum, order) => sum + toNumber(order.total), 0)

export default async function sendWeeklySummary(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notifications = container.resolve(Modules.NOTIFICATION)

  const recipients = resolveAllRecipients({
    dev: process.env.DEV_NOTIFICATION_EMAIL,
    owner: process.env.OWNER_NOTIFICATION_EMAIL,
  })

  if (!recipients.length) {
    logger.warn(
      "[digest] Týdenní souhrn se neodesílá: DEV_NOTIFICATION_EMAIL ani " +
        "OWNER_NOTIFICATION_EMAIL nejsou nastavené."
    )
    return
  }

  // The job runs Monday morning and reports the week that just finished
  // (Monday 00:00 → Monday 00:00), compared with the week before it.
  const now = new Date()
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(endOfWeek.getTime() - WEEK_MS)
  const startOfPrevWeek = new Date(startOfWeek.getTime() - WEEK_MS)
  const weekKey = startOfWeek.toISOString().slice(0, 10)

  // One fetch covering both weeks, partitioned in code — the list workflow is
  // the only source of the computed `payment_status` (same as the daily job).
  const { result } = await getOrdersListWorkflow(container).run({
    input: {
      fields: ORDER_FIELDS,
      variables: {
        filters: {
          created_at: { $gte: startOfPrevWeek, $lt: endOfWeek },
        },
      },
    },
  })
  const orders = Array.isArray(result) ? result : ((result as any)?.rows ?? [])

  const paid = (orders as any[]).filter((order) =>
    PAID_STATUSES.includes(order.payment_status)
  )
  const lastWeek = paid.filter(
    (order) => new Date(order.created_at).getTime() >= startOfWeek.getTime()
  )
  const prevWeek = paid.filter(
    (order) => new Date(order.created_at).getTime() < startOfWeek.getTime()
  )

  const currencyCode = String(
    lastWeek[0]?.currency_code || prevWeek[0]?.currency_code || "czk"
  ).toUpperCase()
  const money = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: currencyCode,
  })

  // Which objects actually sold, by pieces.
  const quantities = new Map<string, number>()
  for (const order of lastWeek) {
    for (const item of order.items || []) {
      const title = item?.product_title || item?.title
      if (!title) {
        continue
      }
      quantities.set(title, (quantities.get(title) ?? 0) + toNumber(item.quantity))
    }
  }
  const topProducts = Array.from(quantities.entries())
    .map(([title, quantity]) => ({ title, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3)

  const dateRange = `${startOfWeek.toLocaleDateString("cs-CZ")} – ${new Date(
    endOfWeek.getTime() - DAY_MS
  ).toLocaleDateString("cs-CZ")}`

  await notifications.createNotifications(
    recipients.map((to) => ({
      to,
      channel: "email",
      template: "merchant-weekly-summary",
      // One summary per week per recipient, whatever happens to the schedule.
      idempotency_key: `mn:weekly:${weekKey}:${to}`,
      trigger_type: "digest",
      data: {
        subject: `Týdenní souhrn · ${dateRange}`,
        date_range: dateRange,
        revenue: money.format(sumRevenue(lastWeek)),
        revenue_prev: money.format(sumRevenue(prevWeek)),
        paid_orders: lastWeek.length,
        paid_orders_prev: prevWeek.length,
        top_products: topProducts,
        admin_url:
          process.env.BACKEND_PUBLIC_URL || process.env.MEDUSA_BACKEND_URL || "",
      },
    })) as never
  )

  logger.info(
    `[digest] Týdenní souhrn za ${weekKey} odeslán ${recipients.length} příjemci(ům): ` +
      `${lastWeek.length} zaplacených objednávek.`
  )
}

export const config = {
  name: "send-weekly-summary",
  // Monday 07:15 — after the stock check (07:00), the daily digest (07:05)
  // and the production-deadline watch (07:10), so the week opens in one batch.
  schedule: "15 7 * * 1",
}
