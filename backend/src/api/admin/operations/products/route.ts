import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isClearanceProduct } from "../../../../lib/clearance"

/**
 * The product list she actually needs (UX overhaul, 2026-08-05).
 *
 * Native Products is a good list and stays — this is not a replacement, and
 * editing still happens in the native editor. What native cannot answer at a
 * glance is the question she asks most: *what kind of thing is this, and where
 * does it sit in the shop?* Category and collection are two clicks into each
 * product, and the four kinds she thinks in — ordinary, made to order, bundle,
 * clearance — are not a native concept at all.
 *
 * So this endpoint classifies and flattens. It creates nothing and changes
 * nothing.
 */

const asPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

export type ProductKind = "standard" | "made-to-order" | "bundle" | "clearance"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const limit = Math.min(asPositiveInt(req.query.limit, 100), 200)
  const search = String(req.query.q ?? "").trim().toLowerCase()
  const kind = String(req.query.kind ?? "standard") as ProductKind

  const [{ data: products }, { data: productionProfiles }, { data: bundles }] =
    await Promise.all([
      query.graph({
        entity: "product",
        fields: [
          "id",
          "title",
          "handle",
          "status",
          "thumbnail",
          "metadata",
          "collection.title",
          "categories.name",
          "variants.id",
          "variants.title",
          "variants.sku",
        ],
      }),
      query.graph({
        entity: "product_production_profile",
        fields: ["product_id", "enabled"],
      }),
      // Bundles link from their own side — the only traversable direction.
      query.graph({ entity: "bundle", fields: ["id", "title", "product.id"] }),
    ])

  const madeToOrderIds = new Set(
    (productionProfiles as any[])
      .filter((profile) => profile?.enabled)
      .map((profile) => profile.product_id)
  )

  const bundleProductIds = new Set(
    (bundles as any[]).flatMap((bundle) =>
      [bundle.product].flat().filter(Boolean).map((product: any) => product.id)
    )
  )

  /**
   * One product can be more than one thing — a clearance piece that is also in
   * a bundle. Order matters: the most specific answer wins, because that is the
   * one that changes how she treats it.
   */
  const kindOf = (product: any): ProductKind => {
    if (bundleProductIds.has(product.id)) {
      return "bundle"
    }
    if (madeToOrderIds.has(product.id)) {
      return "made-to-order"
    }
    if (isClearanceProduct(product)) {
      return "clearance"
    }
    return "standard"
  }

  const rows = (products as any[])
    .map((product) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
      thumbnail: product.thumbnail ?? null,
      kind: kindOf(product),
      collection: product.collection?.title ?? null,
      categories: (product.categories || [])
        .map((category: any) => category?.name)
        .filter(Boolean),
      variant_count: (product.variants || []).length,
      skus: (product.variants || [])
        .map((variant: any) => variant?.sku)
        .filter(Boolean),
    }))
    .filter((row) => row.kind === kind)
    .filter((row) => {
      if (!search) {
        return true
      }
      // Title, handle or SKU — the three things she might have in her hand.
      return (
        row.title?.toLowerCase().includes(search) ||
        row.handle?.toLowerCase().includes(search) ||
        row.skus.some((sku: string) => sku.toLowerCase().includes(search))
      )
    })
    .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "cs"))

  // Counts come from the unfiltered set, so tab badges do not shift as she
  // types in the search box.
  const counts = (products as any[]).reduce(
    (totals, product) => {
      totals[kindOf(product)] += 1
      return totals
    },
    { standard: 0, "made-to-order": 0, bundle: 0, clearance: 0 } as Record<
      ProductKind,
      number
    >
  )

  res.status(200).json({
    products: rows.slice(0, limit),
    count: rows.length,
    counts,
  })
}
