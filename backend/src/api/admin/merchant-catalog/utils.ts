import { MERCHANT_CATALOG_MODULE } from "../../../modules/merchant-catalog"
import type MerchantCatalogModuleService from "../../../modules/merchant-catalog/service"

export async function retrieveMerchantCollections(
  scope: any,
  options: { id?: string; limit?: number; offset?: number; q?: string } = {}
) {
  const query = scope.resolve("query")
  const service: MerchantCatalogModuleService = scope.resolve(MERCHANT_CATALOG_MODULE)
  const filters: Record<string, any> = {}
  if (options.id) {
    filters.id = options.id
  }
  if (options.q) {
    filters.q = options.q
  }
  const { data, metadata } = await query.graph({
    entity: "product_collection",
    fields: [
      "*",
      "products.id",
      "products.title",
      "products.handle",
      "products.thumbnail",
      "products.status",
    ],
    filters,
    pagination: {
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    },
  })

  const ids = data.map((collection: any) => collection.id)
  const profiles = ids.length
    ? await service.listCollectionProfiles({ collection_id: ids })
    : []
  const assignments = ids.length
    ? await service.listCollectionCategoryAssignments({ collection_id: ids })
    : []
  const categoryIds = [...new Set(assignments.map((assignment) => assignment.category_id))]
  const { data: categories } = categoryIds.length
    ? await query.graph({
        entity: "product_category",
        fields: ["*", "products.id", "products.title", "products.thumbnail", "products.status"],
        filters: { id: categoryIds },
      })
    : { data: [] }
  const categoriesById = new Map(categories.map((category: any) => [category.id, category]))

  const collections = data.map((collection: any) => ({
    ...collection,
    profile: profiles.find((profile) => profile.collection_id === collection.id) ?? null,
    categories: assignments
      .filter((assignment) => assignment.collection_id === collection.id)
      .sort((a, b) => a.display_order - b.display_order)
      .map((assignment) => ({
        ...((categoriesById.get(assignment.category_id) ?? {}) as Record<string, unknown>),
        assignment_id: assignment.id,
        display_order: assignment.display_order,
      })),
  }))

  return {
    collections,
    count: metadata?.count ?? collections.length,
    limit: metadata?.take ?? options.limit ?? 50,
    offset: metadata?.skip ?? options.offset ?? 0,
  }
}
