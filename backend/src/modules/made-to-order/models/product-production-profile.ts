import { model } from "@medusajs/framework/utils"

export const ProductProductionProfile = model.define(
  "product_production_profile",
  {
    id: model.id().primaryKey(),
    product_id: model.text().unique(),
    enabled: model.boolean().default(true),
    specification_required: model.boolean().default(true),
    specification_prompt: model.text().nullable(),
    production_time_min_days: model.number().default(14),
    production_time_max_days: model.number().default(42),
    default_deposit_percentage: model.number().default(25),
    contact_customer_after_order: model.boolean().default(true),
    allow_final_price_adjustment: model.boolean().default(true),
  }
)
