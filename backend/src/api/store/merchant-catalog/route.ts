import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { QueryContext } from "@medusajs/framework/utils"
import { MERCHANT_CATALOG_MODULE } from "../../../modules/merchant-catalog"
import type MerchantCatalogModuleService from "../../../modules/merchant-catalog/service"

export const GetStoreMerchantCatalogSchema = z.object({
  currency_code: z.string().length(3).optional(),
  region_id: z.string().optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { currency_code, region_id } = ((req as any).validatedQuery ?? req.query) as z.infer<
    typeof GetStoreMerchantCatalogSchema
  >
  const query = req.scope.resolve("query")
  const service: MerchantCatalogModuleService = req.scope.resolve(MERCHANT_CATALOG_MODULE)
  const profiles = await service.listCollectionProfiles(
    { storefront_visible: true },
    { order: { display_order: "ASC" } }
  )
  const collectionIds = profiles.map((profile) => profile.collection_id)
  const { data: collections } = collectionIds.length
    ? await query.graph({
        entity: "product_collection",
        fields: [
          "*",
          "products.*",
          "products.images.*",
          "products.variants.*",
          "products.variants.calculated_price.*",
        ],
        filters: { id: collectionIds },
        context: {
          products: {
            variants: {
              calculated_price: QueryContext({ region_id, currency_code }),
            },
          },
        },
      })
    : { data: [] }
  const assignments = collectionIds.length
    ? await service.listCollectionCategoryAssignments({ collection_id: collectionIds })
    : []
  const categoryIds = [...new Set(assignments.map((assignment) => assignment.category_id))]
  const { data: categories } = categoryIds.length
    ? await query.graph({
        entity: "product_category",
        fields: ["*", "products.id"],
        filters: { id: categoryIds },
      })
    : { data: [] }
  const collectionById = new Map(collections.map((collection: any) => [collection.id, collection]))
  const categoryById = new Map(categories.map((category: any) => [category.id, category]))
  const groupedCollections = profiles.map((profile) => {
    const collection: any = collectionById.get(profile.collection_id)
    return {
      ...collection,
      profile,
      products: (collection?.products ?? []).filter((product: any) => product.status === "published"),
      categories: assignments
        .filter((assignment) => assignment.collection_id === profile.collection_id)
        .sort((a, b) => a.display_order - b.display_order)
        .map((assignment) => ({
          ...categoryById.get(assignment.category_id),
          display_order: assignment.display_order,
        })),
    }
  })

  const now = Date.now()
  const selections = await service.listSeasonalSelections({ publication_status: "published" })
  const activeSelections = selections.filter((selection) =>
    (!selection.starts_at || new Date(selection.starts_at).getTime() <= now) &&
    (!selection.ends_at || new Date(selection.ends_at).getTime() >= now)
  )
  const selectionIds = activeSelections.map((selection) => selection.id)
  const { data: seasonalSelections } = selectionIds.length
    ? await query.graph({
        entity: "seasonal_selection",
        fields: [
          "*",
          "items.*",
          "items.product.*",
          "items.product.images.*",
          "items.product.variants.*",
          "items.product.variants.calculated_price.*",
          "price_list.*",
        ],
        filters: { id: selectionIds },
        context: {
          items: {
            product: {
              variants: {
                calculated_price: QueryContext({ region_id, currency_code }),
              },
            },
          },
        },
      })
    : { data: [] }

  res.json({
    collections: groupedCollections,
    seasonal_selections: seasonalSelections.map((selection: any) => ({
      ...selection,
      items: [...(selection.items ?? [])].sort(
        (a: any, b: any) => a.display_order - b.display_order
      ),
    })),
  })
}
