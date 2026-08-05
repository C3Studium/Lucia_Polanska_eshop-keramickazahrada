import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isClearanceProduct } from "../../../../lib/clearance"
import { getInventoryAlerts } from "../../../../lib/inventory-alerts"
import { MADE_TO_ORDER_MODULE } from "../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../modules/made-to-order/service"
import { PRODUCT_REVIEW_MODULE } from "../../../../modules/product-review"
import { WISHLIST_MODULE } from "../../../../modules/wishlist"

/**
 * Produkty — the advanced catalog workbench (admin-advanced-plan.md).
 *
 * Přehled's Produkty tab answers „does the catalog have holes?". This answers
 * „how is each product actually doing?" — one row per product with the five
 * things that otherwise live on five pages: stock (inventory), demand
 * (wishlists), reputation (reviews), sales (last 30 days), and the
 * commission terms (production profile, including the deposit floor the
 * slider stands on).
 *
 * ## Why the deposit floor is here
 *
 * The customer-facing slider (deposit-split.ts) is bounded below by
 * `default_deposit_percentage`. That number is the owner's protection —
 * materials covered before work starts — so the place she reviews her
 * catalog is the place she must see it, per product, not buried in a module
 * nobody opens. Editing goes through the existing
 * `/admin/made-to-order/products/:id` routes; this endpoint only refuses to
 * let the number hide.
 *
 * Stock numbers reuse `getInventoryAlerts`' classification verbatim, because
 * the one time this page and the Zásoby tile computed „low" differently it
 * produced the contradiction that took a day to untangle.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const wishlist = req.scope.resolve<any>(WISHLIST_MODULE)
  const reviews = req.scope.resolve<any>(PRODUCT_REVIEW_MODULE)

  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  const search =
    typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : null

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const [productsResult, alerts, profiles, wishlistItems, approvedReviews, recentOrders, bundlesResult] =
    await Promise.all([
      query.graph({
        entity: "product",
        fields: [
          "id",
          "title",
          "handle",
          "status",
          "thumbnail",
          "created_at",
          "metadata",
          "collection.title",
          "categories.name",
          "variants.id",
          "variants.title",
          "variants.sku",
          "variants.prices.amount",
          "variants.prices.currency_code",
        ],
        pagination: { take: 1000, skip: 0 },
      }),
      getInventoryAlerts(req.scope),
      madeToOrder.listProductProductionProfiles({} as never) as Promise<any[]>,
      wishlist.listWishlistItems({}) as Promise<any[]>,
      reviews.listReviews({ status: "schváleno" } as never) as Promise<any[]>,
      query.graph({
        entity: "order",
        fields: ["id", "created_at", "items.product_id", "items.quantity"],
        filters: { created_at: { $gte: since.toISOString() } } as never,
        pagination: { take: 1000, skip: 0 },
      }),
      query
        .graph({ entity: "bundle", fields: ["id", "title", "product.id"] })
        .catch(() => ({ data: [] as any[] })),
    ])

  // A product IS a bundle when it is some bundle's composite product —
  // that is the thing the customer buys, so that is the thing the Balíčky
  // tab lists.
  const bundleByProduct = new Map<string, { id: string; title: string }>()
  for (const bundle of (bundlesResult.data ?? []) as any[]) {
    const linked = Array.isArray(bundle.product)
      ? bundle.product
      : [bundle.product]
    for (const product of linked) {
      if (product?.id) {
        bundleByProduct.set(product.id, { id: bundle.id, title: bundle.title })
      }
    }
  }

  const products = productsResult.data as any[]

  // Availability per variant, straight from the shared classifier's rows so
  // „low" here is the same „low" as everywhere else.
  const availabilityByVariant = new Map<string, number>()
  const stateByVariant = new Map<string, "low" | "out" | "ok">()
  for (const bucket of ["low", "out", "ok"] as const) {
    for (const row of alerts[bucket]) {
      if (row.variant_id) {
        stateByVariant.set(row.variant_id, bucket)
        availabilityByVariant.set(row.variant_id, row.available ?? 0)
      }
    }
  }

  const profileByProduct = new Map(
    (profiles as any[]).map((profile) => [profile.product_id, profile])
  )

  const wishlistCountByVariant = new Map<string, number>()
  for (const item of wishlistItems as any[]) {
    const key = item.product_variant_id
    wishlistCountByVariant.set(key, (wishlistCountByVariant.get(key) ?? 0) + 1)
  }

  const reviewStats = new Map<string, { count: number; sum: number }>()
  for (const review of approvedReviews as any[]) {
    const entry = reviewStats.get(review.product_id) ?? { count: 0, sum: 0 }
    entry.count += 1
    entry.sum += Number(review.rating) || 0
    reviewStats.set(review.product_id, entry)
  }

  const sold30ByProduct = new Map<string, number>()
  for (const order of recentOrders.data as any[]) {
    for (const item of order.items ?? []) {
      if (!item?.product_id) continue
      sold30ByProduct.set(
        item.product_id,
        (sold30ByProduct.get(item.product_id) ?? 0) +
          (Number(item.quantity) || 0)
      )
    }
  }

  const rows = products
    .filter(
      (product) =>
        !search ||
        product.title?.toLowerCase().includes(search) ||
        product.handle?.toLowerCase().includes(search)
    )
    .map((product) => {
      const variants = (product.variants ?? []).map((variant: any) => {
        const czk = (variant.prices ?? []).find(
          (price: any) =>
            String(price.currency_code).toLowerCase() === "czk"
        )
        return {
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          price_czk: czk ? Number(czk.amount) : null,
          available: availabilityByVariant.get(variant.id) ?? null,
          stock_state: stateByVariant.get(variant.id) ?? null,
          wishlist_count: wishlistCountByVariant.get(variant.id) ?? 0,
        }
      })

      const profile = profileByProduct.get(product.id)
      const stats = reviewStats.get(product.id)
      const bundle = bundleByProduct.get(product.id) ?? null
      const clearance = isClearanceProduct(product)
      const kind: "zakazka" | "balicek" | "poskozene" | "bezne" =
        profile?.enabled
          ? "zakazka"
          : bundle
            ? "balicek"
            : clearance
              ? "poskozene"
              : "bezne"
      const totalWishlist = variants.reduce(
        (sum: number, variant: any) => sum + variant.wishlist_count,
        0
      )

      return {
        ...(req.query.expert === "1"
          ? { raw: { ...product, profile: profile ?? null } }
          : {}),
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        kind,
        bundle,
        clearance,
        thumbnail: product.thumbnail,
        collection: product.collection?.title ?? null,
        categories: (product.categories ?? []).map(
          (category: any) => category.name
        ),
        variants,
        sold_30d: sold30ByProduct.get(product.id) ?? 0,
        wishlist_count: totalWishlist,
        review_count: stats?.count ?? 0,
        review_average: stats?.count
          ? Math.round((stats.sum / stats.count) * 10) / 10
          : null,
        production: profile
          ? {
              enabled: profile.enabled,
              deposit_floor_percentage: profile.default_deposit_percentage,
              allow_full_prepayment: profile.allow_full_prepayment !== false,
              production_time_min_days: profile.production_time_min_days,
              production_time_max_days: profile.production_time_max_days,
              specification_required: profile.specification_required,
            }
          : null,
      }
    })

  const kindFilter =
    typeof req.query.kind === "string" ? req.query.kind : null
  const filtered = kindFilter
    ? rows.filter((row) => row.kind === kindFilter)
    : rows

  res.status(200).json({
    products: filtered.slice(offset, offset + limit),
    count: filtered.length,
    kinds: {
      bezne: rows.filter((row) => row.kind === "bezne").length,
      zakazka: rows.filter((row) => row.kind === "zakazka").length,
      balicek: rows.filter((row) => row.kind === "balicek").length,
      poskozene: rows.filter((row) => row.kind === "poskozene").length,
    },
    limit,
    offset,
  })
}
