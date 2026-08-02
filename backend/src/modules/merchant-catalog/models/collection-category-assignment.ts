import { model } from "@medusajs/framework/utils"

export const CollectionCategoryAssignment = model.define(
  "collection_category_assignment",
  {
    id: model.id().primaryKey(),
    collection_id: model.text().index(),
    category_id: model.text().unique(),
    display_order: model.number().default(0),
  }
)
