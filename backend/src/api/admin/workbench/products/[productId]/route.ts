import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getInventoryAlerts } from "../../../../../lib/inventory-alerts"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"
import { MERCHANT_CATALOG_MODULE } from "../../../../../modules/merchant-catalog"
import { PRODUCT_REVIEW_MODULE } from "../../../../../modules/product-review"
import { RESTOCK_MODULE } from "../../../../../modules/restock"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"

/**
 * One product, expanded — Produkty+ „Rozbalit" (phase 3,
 * admin-advanced-plan.md).
 *
 * The row says how the product is doing; this answers the follow-ups
 * without a page switch: which *variant* is the problem, who is waiting on
 * it, what the last reviews actually said, how the months have gone, and
 * where the product is committed (bundles, seasonal sales) — the last one
 * because editing a price without knowing it sits in a running sale is how
 * two systems end up disagreeing about what something costs.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productId = req.params.productId
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const reviews = req.scope.resolve<any>(PRODUCT_REVIEW_MODULE)
  const restock = req.scope.resolve<any>(RESTOCK_MODULE)
  const wishlist = req.scope.resolve<any>(WISHLIST_MODULE)
  const catalog = req.scope.resolve<any>(MERCHANT_CATALOG_MODULE)

  const since = new Date()
  since.setMonth(since.getMonth() - 6)

  const [
    { data: products },
    alerts,
    profiles,
    productReviews,
    subscriptions,
    wishlistItems,
    { data: bundles },
    selections,
    { data: recentOrders },
  ] = await Promise.all([
    query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "handle",
        "status",
        "thumbnail",
        "variants.id",
        "variants.title",
        "variants.sku",
        "variants.prices.amount",
        "variants.prices.currency_code",
      ],
      filters: { id: productId },
    }),
    getInventoryAlerts(req.scope),
    madeToOrder.listProductProductionProfiles({
      product_id: productId,
    } as never) as Promise<any[]>,
    reviews.listReviews(
      { product_id: productId } as never,
      { take: 100 }
    ) as Promise<any[]>,
    restock.listRestockSubscriptions({} as never) as Promise<any[]>,
    wishlist.listWishlistItems({}) as Promise<any[]>,
    query
      .graph({
        entity: "bundle",
        fields: ["id", "title", "product.id"],
      })
      .catch(() => ({ data: [] as any[] })),
    catalog
      .listSeasonalSelections({} as never, { relations: ["items"] })
      .catch(() => [] as any[]) as Promise<any[]>,
    query.graph({
      entity: "order",
      fields: ["id", "created_at", "items.product_id", "items.quantity"],
      filters: { created_at: { $gte: since.toISOString() } } as never,
      pagination: { take: 1000, skip: 0 },
    }),
  ])

  const product = products[0] as any
  if (!product) {
    res.status(404).json({ message: "Produkt nebyl nalezen." })
    return
  }

  const alertByVariant = new Map<string, any>()
  for (const bucket of ["low", "out", "ok"] as const) {
    for (const row of alerts[bucket]) {
      if (row.variant_id) {
        alertByVariant.set(row.variant_id, { ...row, state: bucket })
      }
    }
  }

  const waitingByVariant = new Map<string, number>()
  for (const subscription of subscriptions as any[]) {
    waitingByVariant.set(
      subscription.variant_id,
      (waitingByVariant.get(subscription.variant_id) ?? 0) + 1
    )
  }
  const wishlistByVariant = new Map<string, number>()
  for (const item of wishlistItems as any[]) {
    wishlistByVariant.set(
      item.product_variant_id,
      (wishlistByVariant.get(item.product_variant_id) ?? 0) + 1
    )
  }

  // Monthly sold quantities, oldest → newest, so the UI can show the shape
  // of the last half year without recomputing anything.
  const monthKey = (value: string | Date) => {
    const date = new Date(value)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
  }
  const months: string[] = []
  for (let index = 5; index >= 0; index--) {
    const date = new Date()
    date.setMonth(date.getMonth() - index)
    months.push(monthKey(date))
  }
  const soldByMonth = new Map(months.map((month) => [month, 0]))
  for (const order of recentOrders as any[]) {
    const key = monthKey(order.created_at)
    if (!soldByMonth.has(key)) continue
    for (const item of order.items ?? []) {
      if (item?.product_id === productId) {
        soldByMonth.set(
          key,
          (soldByMonth.get(key) ?? 0) + (Number(item.quantity) || 0)
        )
      }
    }
  }

  const approved = (productReviews as any[]).filter(
    (review) => review.status === "schváleno"
  )

  res.status(200).json({
    id: product.id,
    title: product.title,
    status: product.status,
    variants: (product.variants ?? []).map((variant: any) => {
      const czk = (variant.prices ?? []).find(
        (price: any) => String(price.currency_code).toLowerCase() === "czk"
      )
      const alert = alertByVariant.get(variant.id)
      return {
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        price_czk: czk ? Number(czk.amount) : null,
        available: alert?.available ?? null,
        reserved: alert?.reserved ?? null,
        stock_state: alert?.state ?? null,
        threshold: alert?.threshold ?? null,
        // For the detail page's inline restock — the add-stock route wants
        // the inventory item, not the variant.
        inventory_item_id: alert?.inventory_item_id ?? null,
        waiting_customers: waitingByVariant.get(variant.id) ?? 0,
        wishlist_count: wishlistByVariant.get(variant.id) ?? 0,
      }
    }),
    sales_by_month: months.map((month) => ({
      month,
      sold: soldByMonth.get(month) ?? 0,
    })),
    reviews: {
      count: approved.length,
      average: approved.length
        ? Math.round(
            (approved.reduce(
              (sum, review) => sum + (Number(review.rating) || 0),
              0
            ) /
              approved.length) *
              10
          ) / 10
        : null,
      latest: approved
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 3)
        .map((review) => ({
          rating: review.rating,
          title: review.title ?? null,
          content: review.content,
          created_at: review.created_at,
        })),
    },
    production: (profiles as any[])[0]
      ? {
          enabled: (profiles as any[])[0].enabled,
          deposit_floor_percentage: (profiles as any[])[0]
            .default_deposit_percentage,
          allow_full_prepayment:
            (profiles as any[])[0].allow_full_prepayment !== false,
        }
      : null,
    memberships: {
      bundles: (bundles as any[])
        .filter((bundle) =>
          (Array.isArray(bundle.product)
            ? bundle.product
            : [bundle.product]
          ).some((linked: any) => linked?.id === productId)
        )
        .map((bundle) => ({ id: bundle.id, title: bundle.title })),
      seasonal_selections: (selections as any[])
        .filter((selection) =>
          (selection.items ?? []).some(
            (item: any) => item.product_id === productId
          )
        )
        .map((selection) => ({
          id: selection.id,
          title: selection.title,
          status: selection.publication_status,
        })),
    },
  })
}
