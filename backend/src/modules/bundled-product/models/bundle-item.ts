import { model } from "@medusajs/framework/utils"
import { Bundle } from "./bundle"

export const BundleItem = model.define("bundle_item", {
  id: model.id().primaryKey(),
  quantity: model.number().default(1),
  display_order: model.number().default(0),
  variant_mode: model
    .enum(["customer_selects", "fixed_variant"])
    .default("customer_selects"),
  bundle: model.belongsTo(() => Bundle, {
    mappedBy: "items",
  }),
})
