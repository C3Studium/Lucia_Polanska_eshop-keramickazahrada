import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MERCHANT_ORDER_MODULE } from "../../../../../modules/merchant-order"
import type MerchantOrderModuleService from "../../../../../modules/merchant-order/service"

/**
 * Objednávky+ → Statistiky — the order domain measured.
 *
 * Twelve months of shape (orders and revenue per month), the average order,
 * how customers pay, how orders travel, how fast the workshop actually is
 * (stage history: received → shipped, the only honest lead-time source),
 * and how much money went back. One scan, caps reported.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const merchantOrders = req.scope.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )

  const round = (value: number) => Math.round(value * 100) / 100
  const toNumber = (value: unknown): number => {
    const parsed = Number(
      typeof value === "object" && value !== null
        ? ((value as any).value ?? (value as any).numeric_ ?? 0)
        : value
    )
    return Number.isFinite(parsed) ? parsed : 0
  }

  const yearAgo = new Date()
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)

  const [{ data: orders }, states] = await Promise.all([
    query.graph({
      entity: "order",
      fields: [
        "id",
        "created_at",
        "total",
        "shipping_methods.shipping_option.provider_id",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.amount",
        "payment_collections.payments.refunds.amount",
      ],
      filters: { created_at: { $gte: yearAgo.toISOString() } } as never,
      pagination: { take: 1000, skip: 0, order: { created_at: "DESC" } },
    }),
    merchantOrders.listMerchantOrderStates({} as never, {
      take: 1000,
    } as never) as Promise<any[]>,
  ])

  // ── months, oldest → newest ──
  const monthKey = (value: string | Date) => {
    const date = new Date(value)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
  }
  const months: string[] = []
  for (let index = 11; index >= 0; index--) {
    const date = new Date()
    date.setMonth(date.getMonth() - index)
    months.push(monthKey(date))
  }
  const byMonth = new Map(
    months.map((month) => [month, { orders: 0, revenue: 0 }])
  )

  let revenueTotal = 0
  let refundedTotal = 0
  let pickupOrders = 0
  const paymentProviders = new Map<string, number>()

  for (const order of orders as any[]) {
    const bucket = byMonth.get(monthKey(order.created_at))
    const total = toNumber(order.total)
    revenueTotal = round(revenueTotal + total)
    if (bucket) {
      bucket.orders += 1
      bucket.revenue = round(bucket.revenue + total)
    }

    if (
      (order.shipping_methods ?? []).some((method: any) =>
        String(method?.shipping_option?.provider_id ?? "").includes("pickup")
      )
    ) {
      pickupOrders += 1
    }

    const payments = (order.payment_collections ?? []).flatMap(
      (collection: any) => collection?.payments ?? []
    )
    for (const payment of payments) {
      if (payment?.provider_id) {
        paymentProviders.set(
          payment.provider_id,
          (paymentProviders.get(payment.provider_id) ?? 0) + 1
        )
      }
      refundedTotal = round(
        refundedTotal +
          (payment?.refunds ?? []).reduce(
            (sum: number, refund: any) => sum + toNumber(refund.amount),
            0
          )
      )
    }
  }

  // ── lead time from stage history: received/created → shipped ──
  const DAY = 1000 * 60 * 60 * 24
  const leadTimes: number[] = []
  for (const state of states as any[]) {
    const history = Array.isArray(state.stage_history)
      ? state.stage_history
      : []
    const shipped = history.find((entry: any) => entry.to === "shipped")
    const start = history[0]
    if (shipped && start) {
      const days =
        (new Date(shipped.at).getTime() - new Date(start.at).getTime()) / DAY
      if (Number.isFinite(days) && days >= 0) {
        leadTimes.push(days)
      }
    }
  }
  leadTimes.sort((a, b) => a - b)
  const median = leadTimes.length
    ? Math.round(leadTimes[Math.floor(leadTimes.length / 2)] * 10) / 10
    : null

  const orderCount = (orders as any[]).length

  res.status(200).json({
    months: months.map((month) => ({ month, ...byMonth.get(month)! })),
    orders_365d: orderCount,
    revenue_365d: revenueTotal,
    average_order: orderCount ? round(revenueTotal / orderCount) : null,
    refunded_365d: refundedTotal,
    pickup_share: orderCount
      ? Math.round((pickupOrders / orderCount) * 100)
      : null,
    payment_providers: [...paymentProviders.entries()]
      .map(([provider, count]) => ({ provider, count }))
      .sort((a, b) => b.count - a.count),
    lead_time_days_median: median,
    lead_times_measured: leadTimes.length,
    orders_scanned: orderCount,
  })
}
