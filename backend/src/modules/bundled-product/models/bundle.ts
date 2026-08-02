import { model } from "@medusajs/framework/utils"
import { BundleItem } from "./bundle-item"

export const Bundle = model.define("bundle", {
  id: model.id().primaryKey(),
  title: model.text(),
  pricing_mode: model
    .enum(["component_sum", "component_sum_discount", "fixed_price"])
    .default("component_sum"),
  discount_percentage: model.number().nullable(),
  items: model.hasMany(() => BundleItem, {
    mappedBy: "bundle",
  }),
})
