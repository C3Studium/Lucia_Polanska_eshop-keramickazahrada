import { model } from "@medusajs/framework/utils"

export const VariantProductionProfile = model.define(
  "variant_production_profile",
  {
    id: model.id().primaryKey(),
    variant_id: model.text().unique(),
    deposit_percentage_override: model.number().nullable(),
    production_time_min_days_override: model.number().nullable(),
    production_time_max_days_override: model.number().nullable(),
  }
)
