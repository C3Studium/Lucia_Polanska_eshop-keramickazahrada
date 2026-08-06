/**
 * What each discount instrument actually generated (Slevy+ Statistiky).
 *
 * One pass over one order scan answers three shapes of question:
 *
 * - **Per code** — orders that used it, their summed revenue, and the total
 *   discount given away. Revenue is the *order total* (money asked for the
 *   whole basket the code sat in), because "kolik ta sleva přinesla" is a
 *   question about baskets, not about the discounted line alone.
 * - **Per campaign** — the roll-up of its member codes.
 * - **Per seasonal sale** — revenue of the member products' order lines
 *   inside the sale's window. Line revenue here, not basket: a seasonal
 *   sale is about specific products, and crediting it with the whole basket
 *   would double-count every mixed order across sales.
 *
 * Pure functions over plain rows so the arithmetic is unit-testable and the
 * endpoint stays a projection. The order scan is capped by the caller; the
 * cap is honest reporting territory, not silent truncation — the endpoint
 * reports `orders_scanned`.
 */

export type OrderScanRow = {
  id: string
  created_at: string
  total: number
  items: {
    product_id: string | null
    total: number
    adjustments: { code: string | null; amount: number }[]
  }[]
}

export type CodeStats = {
  orders: number
  revenue: number
  discount_given: number
}

const round = (value: number) => Math.round(value * 100) / 100

/** Usage, basket revenue and discount given, per promotion code. */
export const statsByCode = (
  orders: OrderScanRow[]
): Map<string, CodeStats> => {
  const stats = new Map<string, CodeStats>()

  for (const order of orders) {
    const codesInOrder = new Map<string, number>()
    for (const item of order.items) {
      for (const adjustment of item.adjustments) {
        if (!adjustment.code) continue
        codesInOrder.set(
          adjustment.code,
          round(
            (codesInOrder.get(adjustment.code) ?? 0) +
              (Number(adjustment.amount) || 0)
          )
        )
      }
    }

    for (const [code, discount] of codesInOrder) {
      const entry = stats.get(code) ?? {
        orders: 0,
        revenue: 0,
        discount_given: 0,
      }
      entry.orders += 1
      entry.revenue = round(entry.revenue + (Number(order.total) || 0))
      entry.discount_given = round(entry.discount_given + discount)
      stats.set(code, entry)
    }
  }

  return stats
}

/**
 * Line revenue of a product set within a window — the seasonal-sale
 * question. `starts_at`/`ends_at` nullable: an open end means the window
 * extends to the scan's edge.
 */
export const revenueForProducts = (
  orders: OrderScanRow[],
  productIds: Set<string>,
  startsAt: string | null,
  endsAt: string | null
): { orders: number; units_revenue: number } => {
  let matchedOrders = 0
  let revenue = 0

  for (const order of orders) {
    if (startsAt && order.created_at < startsAt) continue
    if (endsAt && order.created_at > endsAt) continue

    let matched = false
    for (const item of order.items) {
      if (item.product_id && productIds.has(item.product_id)) {
        matched = true
        revenue = round(revenue + (Number(item.total) || 0))
      }
    }
    if (matched) matchedOrders += 1
  }

  return { orders: matchedOrders, units_revenue: revenue }
}
