import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getInventoryAlerts } from "../../../../lib/inventory-alerts"
import { RESTOCK_MODULE } from "../../../../modules/restock"
import { WISHLIST_MODULE } from "../../../../modules/wishlist"

/**
 * Sklad — the advanced inventory workbench (admin-advanced-plan.md).
 *
 * Přehled's Zásoby answers „what needs restocking?". This adds the question
 * that actually orders a restocking day: **„what do people want?"** Every
 * variant row carries two demand numbers no stock page had:
 *
 * - `waiting_customers` — restock subscriptions not yet notified. These are
 *   people who asked to be told; each one is a sale sitting on zero stock.
 * - `wishlist_count` — quieter interest, but interest.
 *
 * Sorted by demand within each bucket, so the restock list starts with what
 * sells itself, not with the alphabet.
 *
 * Classification (low/out/ok and thresholds) is `getInventoryAlerts`,
 * verbatim — same rule as the Přehled tile, the daily job and the products
 * workbench. Threshold editing stays on the inventory item
 * (`metadata.low_stock_threshold`, native route), which is the single place
 * that number lives.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const restock = req.scope.resolve<any>(RESTOCK_MODULE)
  const wishlist = req.scope.resolve<any>(WISHLIST_MODULE)

  const [alerts, subscriptions, wishlistItems] = await Promise.all([
    getInventoryAlerts(req.scope),
    // Every subscription row is a waiting customer: the send workflow
    // deletes rows after notifying, so existence *is* the waiting state.
    restock.listRestockSubscriptions({} as never) as Promise<any[]>,
    wishlist.listWishlistItems({}) as Promise<any[]>,
  ])

  const waitingByVariant = new Map<string, number>()
  for (const subscription of subscriptions as any[]) {
    const key = subscription.variant_id
    waitingByVariant.set(key, (waitingByVariant.get(key) ?? 0) + 1)
  }

  const wishlistByVariant = new Map<string, number>()
  for (const item of wishlistItems as any[]) {
    const key = item.product_variant_id
    wishlistByVariant.set(key, (wishlistByVariant.get(key) ?? 0) + 1)
  }

  const decorate = (rows: any[]) =>
    rows
      .map((row) => ({
        ...row,
        waiting_customers: waitingByVariant.get(row.variant_id) ?? 0,
        wishlist_count: wishlistByVariant.get(row.variant_id) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.waiting_customers - a.waiting_customers ||
          b.wishlist_count - a.wishlist_count
      )

  res.status(200).json({
    out: decorate(alerts.out),
    low: decorate(alerts.low),
    ok: decorate(alerts.ok),
    default_threshold: alerts.default_threshold,
    waiting_total: subscriptions.length,
  })
}
