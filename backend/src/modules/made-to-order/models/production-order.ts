import { model } from "@medusajs/framework/utils"
import { ProductionPaymentRequest } from "./production-payment-request"

export const ProductionOrder = model.define("production_order", {
  id: model.id().primaryKey(),
  order_id: model.text().unique(),
  stage: model
    .enum([
      "specification_pending",
      "confirmed",
      "in_production",
      "awaiting_balance",
      "ready_to_ship",
      "completed",
      "cancelled",
    ])
    .index()
    .default("specification_pending"),
  deposit_percentage: model.number(),
  agreed_total: model.bigNumber().nullable(),
  original_total: model.bigNumber(),
  currency_code: model.text(),
  estimated_completion_at: model.dateTime().nullable(),
  specification_confirmed_at: model.dateTime().nullable(),
  production_started_at: model.dateTime().nullable(),
  production_completed_at: model.dateTime().nullable(),
  balance_requested_at: model.dateTime().nullable(),
  final_total_confirmed_at: model.dateTime().nullable(),
  ready_to_ship_at: model.dateTime().nullable(),
  completed_at: model.dateTime().nullable(),
  customer_note: model.text().nullable(),
  internal_note: model.text().nullable(),
  payment_requests: model.hasMany(() => ProductionPaymentRequest, {
    mappedBy: "production_order",
  }),
})
