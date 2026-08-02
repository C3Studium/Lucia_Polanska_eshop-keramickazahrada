import { model } from "@medusajs/framework/utils"
import { SeasonalSelection } from "./seasonal-selection"

export const SeasonalSelectionItem = model.define("seasonal_selection_item", {
  id: model.id().primaryKey(),
  product_id: model.text().index(),
  display_order: model.number().default(0),
  selection: model.belongsTo(() => SeasonalSelection, {
    mappedBy: "items",
  }),
})
