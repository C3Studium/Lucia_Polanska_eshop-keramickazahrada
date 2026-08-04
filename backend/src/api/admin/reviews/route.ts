import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

/**
 * The moderation page shows one tab per status (§12), so the list has to be
 * filterable by it. The values are the model's literal Czech enum members
 * (`src/modules/product-review/models/review.ts`) — diacritics included.
 *
 * Anything in the validated query that is not limit/offset/fields/order lands
 * in `req.filterableFields`, which is what gets handed to `query.graph` below.
 */
export const REVIEW_STATUSES = [
  "čeká na schválení",
  "schváleno",
  "zamítnuto",
] as const

export const GetAdminReviewsSchema = createFindParams().merge(
  z.object({
    status: z.enum(REVIEW_STATUSES).optional(),
    customer_id: z.string().optional(),
  })
)

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve("query")

  const {
    data: reviews,
    metadata: { count, take, skip } = {
      count: 0,
      take: 20,
      skip: 0
    },
  } = await query.graph({
    entity: "review",
    ...req.queryConfig,
    filters: {
      ...(req.queryConfig as { filters?: Record<string, unknown> }).filters,
      ...req.filterableFields,
    },
  })

  res.json({
    reviews,
    count,
    limit: take,
    offset: skip,
  })
}
