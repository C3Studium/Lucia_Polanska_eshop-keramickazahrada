import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Products customers cannot find (§9, P8-4).
 *
 * A published product in no category and no collection is reachable only by
 * search, which makes it effectively invisible to anyone browsing. That is not
 * an error — Medusa is perfectly happy — so nothing ever surfaces it, and a
 * piece can sit unsold for months for a reason nobody thought to check.
 *
 * Read-only, and counts rather than judges: having one unfiled product she is
 * about to sort out is entirely reasonable.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "thumbnail", "collection_id", "categories.id"],
    filters: { status: "published" },
  })

  const unclassified = (products as any[])
    .filter(
      (product) => !product.collection_id && !(product.categories || []).length
    )
    .map((product) => ({
      id: product.id,
      title: product.title,
      thumbnail: product.thumbnail ?? null,
    }))

  res.status(200).json({
    unclassified_count: unclassified.length,
    published_count: (products as any[]).length,
    unclassified: unclassified.slice(0, 20),
  })
}
