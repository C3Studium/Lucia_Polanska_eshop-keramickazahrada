import { model } from "@medusajs/framework/utils"
import { MERCHANT_ORDER_STAGES } from "../stages"

export const MerchantOrderState = model.define("merchant_order_state", {
  id: model.id().primaryKey(),
  order_id: model.text().unique(),
  // Values and their order are identical to the previous inline literal, so the
  // generated schema is unchanged and no migration is required.
  stage: model
    .enum([...MERCHANT_ORDER_STAGES])
    .index()
    .default("received"),
  requires_attention: model.boolean().default(false),
  attention_reason: model.text().nullable(),
  stage_changed_at: model.dateTime().nullable(),
  stage_changed_by: model.text().nullable(),
  internal_note: model.text().nullable(),
  /**
   * Every stage change, appended in order: {from, to, at, by, note}.
   * `stage_changed_at/by` keep answering "what is true now"; this answers
   * "how did it get here", which is the question when a customer calls about
   * an order that took three weeks.
   */
  stage_history: model.json().default([] as unknown as Record<string, unknown>),
})
