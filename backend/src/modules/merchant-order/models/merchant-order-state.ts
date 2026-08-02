import { model } from "@medusajs/framework/utils"

export const MerchantOrderState = model.define("merchant_order_state", {
  id: model.id().primaryKey(),
  order_id: model.text().unique(),
  stage: model
    .enum([
      "received",
      "working",
      "shipping",
      "shipped",
      "payment_problem",
      "cancelled",
    ])
    .index()
    .default("received"),
  requires_attention: model.boolean().default(false),
  attention_reason: model.text().nullable(),
  stage_changed_at: model.dateTime().nullable(),
  stage_changed_by: model.text().nullable(),
  internal_note: model.text().nullable(),
})
