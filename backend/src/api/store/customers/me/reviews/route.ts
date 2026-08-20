import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

export const GetStoreCustomerReviewsSchema = createFindParams()

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: reviews, metadata: { count, take, skip } = { count: 0, take: 10, skip: 0 } } = await query.graph({
    entity: "review",
    fields: [
      "id",
      "title",
      "content",
      "rating",
      "first_name",
      "last_name",
      "status",
      "product_id",
      "created_at",
      "updated_at",
    ],
    filters: {
      customer_id: customerId,
    },
    ...req.queryConfig,
  })

  const safe = Array.isArray(reviews) ? reviews.filter((r: any) => !!r) : []

  // Enrich with product info (title, handle, thumbnail) so UI can show which product the review belongs to
  const productIds = Array.from(
    new Set(
      safe
        .map((r: any) => r?.product_id)
        .filter((id: any): id is string => typeof id === "string" && id.length > 0)
    )
  )

  let productsById: Record<string, { id: string; title?: string; handle?: string; thumbnail?: string }> = {}
  if (productIds.length > 0) {
    try {
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "title", "handle", "thumbnail"],
        filters: { id: productIds },
      })

      if (Array.isArray(products)) {
        productsById = products.reduce((acc: any, p: any) => {
          if (p && p.id) acc[p.id] = { id: p.id, title: p.title, handle: p.handle, thumbnail: p.thumbnail }
          return acc
        }, {} as Record<string, { id: string; title?: string; handle?: string; thumbnail?: string }>)
      }
    } catch (e) {
      // eslint-disable-next-line no-console
    }
  }

  const enriched = safe.map((r: any) => ({
    ...r,
    product: r?.product_id ? productsById[r.product_id] : undefined,
  }))

  // eslint-disable-next-line no-console
  return res.json({ reviews: enriched, count, limit: take, offset: skip })
}
