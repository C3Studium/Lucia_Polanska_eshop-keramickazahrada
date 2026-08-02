import { model } from "@medusajs/framework/utils"

export const CollectionProfile = model.define("collection_profile", {
  id: model.id().primaryKey(),
  collection_id: model.text().unique(),
  description: model.text().nullable(),
  cover_image_url: model.text().nullable(),
  mobile_image_url: model.text().nullable(),
  storefront_visible: model.boolean().default(true),
  display_order: model.number().default(0),
  seo_title: model.text().nullable(),
  seo_description: model.text().nullable(),
})
