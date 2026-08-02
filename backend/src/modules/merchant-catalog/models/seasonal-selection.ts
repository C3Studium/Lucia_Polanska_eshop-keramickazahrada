import { model } from "@medusajs/framework/utils"
import { SeasonalSelectionItem } from "./seasonal-selection-item"

export const SeasonalSelection = model.define("seasonal_selection", {
  id: model.id().primaryKey(),
  title: model.text(),
  handle: model.text().unique(),
  description: model.text().nullable(),
  cover_image_url: model.text().nullable(),
  mobile_image_url: model.text().nullable(),
  publication_status: model
    .enum(["draft", "published", "archived"])
    .index()
    .default("draft"),
  starts_at: model.dateTime().index().nullable(),
  ends_at: model.dateTime().index().nullable(),
  linked_price_list_id: model.text().index().nullable(),
  items: model.hasMany(() => SeasonalSelectionItem, {
    mappedBy: "selection",
  }),
})
