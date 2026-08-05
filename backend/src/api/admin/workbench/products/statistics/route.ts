import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isClearanceProduct, isSoldOut } from "../../../../../lib/clearance"
import { outstandingFor } from "../../../../../lib/balance-payment"
import { getInventoryAlerts } from "../../../../../lib/inventory-alerts"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"
import { PRODUCT_REVIEW_MODULE } from "../../../../../modules/product-review"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"

/**
 * Produkty+ → Statistiky — the product domain measured, in one response
 * (Matěj's brief: „every possible statistic about the products, zakázky,
 * bundles etc").
 *
 * Everything derives from the same sources the other tabs read — the alert
 * classifier, the production module, one order scan — so a number here never
 * disagrees with the tab it summarises. The order scan is capped at the last
 * 1000 orders and the cap is *reported* (`orders_scanned`), because a
 * statistic that silently covers an unknown slice is worse than none.
 *
 * Bundle sales count line items carrying `metadata.bundle_id` — the marker
 * `add-bundle-to-cart` writes — so a bundle bought as a bundle is counted
 * and its components bought separately are not.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const reviews = req.scope.resolve<any>(PRODUCT_REVIEW_MODULE)
  const wishlist = req.scope.resolve<any>(WISHLIST_MODULE)

  const round = (value: number) => Math.round(value * 100) / 100
  const yearAgo = new Date()
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)

  const [
    { data: products },
    alerts,
    profiles,
    productionOrders,
    allReviews,
    wishlistItems,
    { data: bundles },
    { data: scannedOrders },
  ] = await Promise.all([
    query.graph({
      entity: "product",
      fields: ["id", "title", "status", "metadata", "variants.id"],
      pagination: { take: 1000, skip: 0 },
    }),
    getInventoryAlerts(req.scope),
    madeToOrder.listProductProductionProfiles({} as never) as Promise<any[]>,
    madeToOrder.listProductionOrders({} as never) as Promise<any[]>,
    reviews.listReviews({} as never) as Promise<any[]>,
    wishlist.listWishlistItems({}) as Promise<any[]>,
    query
      .graph({ entity: "bundle", fields: ["id", "title", "product.id"] })
      .catch(() => ({ data: [] as any[] })),
    query
      .graph({
        entity: "order",
        fields: [
          "id",
          "created_at",
          "items.product_id",
          "items.quantity",
          "items.total",
          "items.metadata",
        ],
        filters: { created_at: { $gte: yearAgo.toISOString() } } as never,
        pagination: { take: 1000, skip: 0, order: { created_at: "DESC" } },
      })
      .catch(() => ({ data: [] as any[] })),
  ])

  const titleByProduct = new Map(
    (products as any[]).map((product) => [product.id, product.title])
  )
  const profileByProduct = new Map(
    (profiles as any[]).map((profile) => [profile.product_id, profile])
  )
  const bundleProductIds = new Set<string>()
  const bundleTitleById = new Map<string, string>()
  for (const bundle of bundles as any[]) {
    bundleTitleById.set(bundle.id, bundle.title)
    const linked = Array.isArray(bundle.product)
      ? bundle.product
      : [bundle.product]
    for (const product of linked) {
      if (product?.id) bundleProductIds.add(product.id)
    }
  }

  // ── kinds ──
  const kinds = { bezne: 0, zakazka: 0, balicek: 0, poskozene: 0 }
  let clearanceSoldOut = 0
  const variantsByProduct = new Map<string, string[]>()
  for (const product of products as any[]) {
    variantsByProduct.set(
      product.id,
      (product.variants ?? []).map((variant: any) => variant.id)
    )
    if (profileByProduct.get(product.id)?.enabled) kinds.zakazka += 1
    else if (bundleProductIds.has(product.id)) kinds.balicek += 1
    else if (isClearanceProduct(product)) {
      kinds.poskozene += 1
      const availables = (product.variants ?? []).map((variant: any) => ({
        available:
          [...alerts.low, ...alerts.out, ...alerts.ok].find(
            (row) => row.variant_id === variant.id
          )?.available ?? 0,
      }))
      if (isSoldOut(availables)) clearanceSoldOut += 1
    } else kinds.bezne += 1
  }

  // ── sales: 30 days and 365 days, by quantity and revenue ──
  type Seller = { product_id: string; qty: number; revenue: number }
  const accumulate = (since: Date): Map<string, Seller> => {
    const map = new Map<string, Seller>()
    for (const order of scannedOrders as any[]) {
      if (String(order.created_at) < since.toISOString()) continue
      for (const item of order.items ?? []) {
        if (!item?.product_id) continue
        const entry = map.get(item.product_id) ?? {
          product_id: item.product_id,
          qty: 0,
          revenue: 0,
        }
        entry.qty += Number(item.quantity) || 0
        entry.revenue = round(entry.revenue + (Number(item.total) || 0))
        map.set(item.product_id, entry)
      }
    }
    return map
  }
  const toTop = (map: Map<string, Seller>) =>
    [...map.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map((seller) => ({
        ...seller,
        title: titleByProduct.get(seller.product_id) ?? seller.product_id,
      }))

  // ── zakázky ──
  const productionIds = (productionOrders as any[]).map((p) => p.id)
  const requests = productionIds.length
    ? ((await madeToOrder.listProductionPaymentRequests({
        production_order_id: productionIds,
      } as never)) as any[])
    : []
  const requestsByProduction = new Map<string, any[]>()
  for (const request of requests) {
    const list = requestsByProduction.get(request.production_order_id) ?? []
    list.push(request)
    requestsByProduction.set(request.production_order_id, list)
  }
  const stageCounts: Record<string, number> = {}
  let outstandingTotal = 0
  let depositsPaid = 0
  for (const production of productionOrders as any[]) {
    stageCounts[production.stage] = (stageCounts[production.stage] ?? 0) + 1
    const productionRequests = requestsByProduction.get(production.id) ?? []
    outstandingTotal = round(
      outstandingTotal + outstandingFor(production, productionRequests)
    )
    depositsPaid = round(
      depositsPaid +
        productionRequests
          .filter((request) => request.status === "paid")
          .reduce(
            (sum, request) => sum + (Number(request.amount) || 0),
            0
          )
    )
  }
  const floors = (profiles as any[])
    .filter((profile) => profile.enabled)
    .map((profile) => Number(profile.default_deposit_percentage) || 0)

  // ── bundles sold, from the line-item marker ──
  const bundleSales = new Map<string, { qty: number; revenue: number }>()
  for (const order of scannedOrders as any[]) {
    for (const item of order.items ?? []) {
      const bundleId = (item?.metadata as any)?.bundle_id
      if (!bundleId) continue
      const entry = bundleSales.get(bundleId) ?? { qty: 0, revenue: 0 }
      entry.qty += Number(item.quantity) || 0
      entry.revenue = round(entry.revenue + (Number(item.total) || 0))
      bundleSales.set(bundleId, entry)
    }
  }

  // ── wishlist demand, per product ──
  const variantToProduct = new Map<string, string>()
  for (const [productId, variantIds] of variantsByProduct) {
    for (const variantId of variantIds) {
      variantToProduct.set(variantId, productId)
    }
  }
  const wishlistByProduct = new Map<string, number>()
  for (const item of wishlistItems as any[]) {
    const productId = variantToProduct.get(item.product_variant_id)
    if (!productId) continue
    wishlistByProduct.set(
      productId,
      (wishlistByProduct.get(productId) ?? 0) + 1
    )
  }

  const approved = (allReviews as any[]).filter(
    (review) => review.status === "schváleno"
  )

  res.status(200).json({
    kinds,
    stock: {
      out: alerts.out.length,
      low: alerts.low.length,
      ok: alerts.ok.length,
    },
    top_sellers_30d: toTop(accumulate(monthAgo)),
    top_sellers_365d: toTop(accumulate(yearAgo)),
    zakazky: {
      total: (productionOrders as any[]).length,
      by_stage: stageCounts,
      outstanding_total: outstandingTotal,
      deposits_paid: depositsPaid,
      average_floor_percentage: floors.length
        ? Math.round(
            floors.reduce((sum, value) => sum + value, 0) / floors.length
          )
        : null,
    },
    bundles: [...bundleSales.entries()]
      .map(([bundleId, sales]) => ({
        id: bundleId,
        title: bundleTitleById.get(bundleId) ?? bundleId,
        ...sales,
      }))
      .sort((a, b) => b.qty - a.qty),
    wishlist_top: [...wishlistByProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([productId, count]) => ({
        product_id: productId,
        title: titleByProduct.get(productId) ?? productId,
        count,
      })),
    clearance: {
      total: kinds.poskozene,
      sold_out_awaiting_removal: clearanceSoldOut,
    },
    reviews: {
      total: (allReviews as any[]).length,
      approved: approved.length,
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
    },
    orders_scanned: (scannedOrders as any[]).length,
  })
}
