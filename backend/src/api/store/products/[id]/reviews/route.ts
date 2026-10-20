import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRODUCT_REVIEW_MODULE } from "../../../../../modules/product-review"
import ProductReviewModuleService from "../../../../../modules/product-review/service"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

export const GetStoreReviewsSchema = createFindParams()

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const reviewModuleService: ProductReviewModuleService = req.scope.resolve(PRODUCT_REVIEW_MODULE)

  // Get reviews for product
  //
  // Pole jsou pevná a stojí ZA `req.queryConfig`: dřív ho rozprostření
  // přepsalo, takže platily výchozí pole z middlewaru (bez
  // `verified_purchase`) a klient si přes `?fields=` mohl vyžádat cokoli,
  // i `customer_id`. Z queryConfigu se bere jen stránkování a řazení.
  const { data: reviews, metadata: {
    count,
    take,
    skip
  } = { count: 0, take: 10, skip: 0 } } = await query.graph({
    entity: "review",
    ...req.queryConfig,
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
      // Štítek „Ověřený nákup" — storefront ho ukáže jen při `true` (§ 5 ZOS).
      "verified_purchase",
    ],
    filters: {
      product_id: id,
      status: "schváleno"
    },
  })

  const safe = Array.isArray(reviews) ? reviews.filter((r: any) => !!r) : []
  res.json({
    reviews: safe,
    count,
    limit: take,
    offset: skip,
    average_rating: await reviewModuleService.getAverageRating(id)
  })
}



