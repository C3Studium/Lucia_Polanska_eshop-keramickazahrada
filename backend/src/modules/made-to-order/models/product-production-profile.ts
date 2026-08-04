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
  /**
   * Whether checkout may offer „zaplatit celou částku rovnou" for this
   * product. Some pieces she may not want prepaid at all — a six-week
   * commission taken in full up front is a refund waiting to happen if the
   * customer changes their mind.
   */
  allow_full_prepayment: model.boolean().default(true),
  }
)
