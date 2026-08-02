import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { MERCHANT_CATALOG_MODULE } from "../../../../modules/merchant-catalog"
import type MerchantCatalogModuleService from "../../../../modules/merchant-catalog/service"

export const GetMerchantCategoriesSchema = z.object({
  collection_id: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const input = ((req as any).validatedQuery ?? req.query) as z.infer<
    typeof GetMerchantCategoriesSchema
  >
  const service: MerchantCatalogModuleService = req.scope.resolve(MERCHANT_CATALOG_MODULE)
  const assignments = await service.listCollectionCategoryAssignments(
    input.collection_id ? { collection_id: input.collection_id } : {}
  )
  const query = req.scope.resolve("query")
  const categoryIds = input.collection_id
    ? assignments.map((assignment) => assignment.category_id)
    : undefined
  const { data, metadata } = await query.graph({
    entity: "product_category",
    fields: [
      "*",
      "parent_category.id",
      "category_children.id",
      "products.id",
      "products.title",
      "products.thumbnail",
      "products.status",
    ],
    filters: categoryIds ? { id: categoryIds } : {},
    pagination: { take: input.limit, skip: input.offset },
  })
  const assignmentByCategory = new Map(
    assignments.map((assignment) => [assignment.category_id, assignment])
  )
  const categories = data.map((category: any) => {
    const assignment = assignmentByCategory.get(category.id)
    return {
      ...category,
      children: category.category_children ?? [],
      collection_id: assignment?.collection_id ?? null,
      display_order: assignment?.display_order ?? null,
    }
  }).sort((a: any, b: any) => (a.display_order ?? 9999) - (b.display_order ?? 9999))

  res.json({
    categories,
    count: metadata?.count ?? categories.length,
    limit: metadata?.take ?? input.limit,
    offset: metadata?.skip ?? input.offset,
  })
}
