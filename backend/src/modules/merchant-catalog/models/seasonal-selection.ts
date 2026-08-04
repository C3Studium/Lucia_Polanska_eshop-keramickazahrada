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
  /**
   * What happens to the products when the sale ends.
   *
   * A výprodej is not a season: when a clearance ends the pieces are gone and
   * should leave the shop, while a Christmas collection goes back to full price
   * and stays. Getting this wrong either leaves sold-out pieces on sale or
   * quietly hides stock she still wants to sell, so it is decided per sale
   * rather than guessed.
   */
  on_end: model
    .enum(["keep_selling", "hide_products"])
    .default("keep_selling"),
  items: model.hasMany(() => SeasonalSelectionItem, {
    mappedBy: "selection",
  }),
})
