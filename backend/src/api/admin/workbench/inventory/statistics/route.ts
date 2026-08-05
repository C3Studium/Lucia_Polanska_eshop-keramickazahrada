import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getInventoryAlerts } from "../../../../../lib/inventory-alerts"
import { RESTOCK_MODULE } from "../../../../../modules/restock"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"

/**
 * Sklad+ → Statistiky — how much clay is sitting on shelves, in money.
 *
 * Stock value prices each variant's availability at its CZK price — money
 * asked, not cost (the shop does not track cost). The demand block restates
 * the queue the list sorts by, as totals.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const restock = req.scope.resolve<any>(RESTOCK_MODULE)
  const wishlist = req.scope.resolve<any>(WISHLIST_MODULE)

  const round = (value: number) => Math.round(value * 100) / 100

  const [alerts, { data: products }, subscriptions, wishlistItems] =
    await Promise.all([
      getInventoryAlerts(req.scope),
      query.graph({
        entity: "product",
        fields: [
          "id",
          "variants.id",
          "variants.prices.amount",
          "variants.prices.currency_code",
        ],
        pagination: { take: 1000, skip: 0 },
      }),
      restock.listRestockSubscriptions({} as never).catch(() => []) as Promise<any[]>,
      wishlist.listWishlistItems({}).catch(() => []) as Promise<any[]>,
    ])

  const priceByVariant = new Map<string, number>()
  for (const product of products as any[]) {
    for (const variant of product.variants ?? []) {
      const czk = (variant.prices ?? []).find(
        (price: any) => String(price.currency_code).toLowerCase() === "czk"
      )
      if (czk) priceByVariant.set(variant.id, Number(czk.amount) || 0)
    }
  }

  let pieces = 0
  let value = 0
  let unpricedVariants = 0
  for (const bucket of ["low", "ok"] as const) {
    for (const row of alerts[bucket]) {
      const available = Number(row.available) || 0
      pieces += available
      const price = priceByVariant.get(row.variant_id ?? "")
      if (price === undefined) {
        unpricedVariants += 1
      } else {
        value = round(value + available * price)
      }
    }
  }

  res.status(200).json({
    pieces_in_stock: pieces,
    stock_value_czk: value,
    unpriced_variants: unpricedVariants,
    variants: {
      out: alerts.out.length,
      low: alerts.low.length,
      ok: alerts.ok.length,
    },
    demand: {
      waiting_customers: (subscriptions as any[]).length,
      wishlist_saves: (wishlistItems as any[]).length,
    },
    default_threshold: alerts.default_threshold,
  })
}
