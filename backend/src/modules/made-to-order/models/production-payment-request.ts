import { model } from "@medusajs/framework/utils"
import { ProductionOrder } from "./production-order"

export const ProductionPaymentRequest = model.define(
  "production_payment_request",
  {
    id: model.id().primaryKey(),
    type: model.enum(["deposit", "balance"]),
    status: model
      .enum(["draft", "pending", "sent", "paid", "failed", "expired", "cancelled"])
      .index()
      .default("draft"),
    amount: model.bigNumber(),
    currency_code: model.text(),
    payment_collection_id: model.text().index().nullable(),
    payment_session_id: model.text().index().nullable(),
    provider_transaction_id: model.text().unique().nullable(),
    payment_url: model.text().nullable(),
    selected_method: model.text().nullable(),
    provider_status: model.text().index().nullable(),
    provider_error_reason: model.text().nullable(),
    create_state: model
      .enum(["not_started", "creating", "created", "unknown", "failed"])
      .default("not_started"),
    idempotency_key: model.text().unique(),
    sent_at: model.dateTime().nullable(),
    notification_sent_at: model.dateTime().nullable(),
    paid_at: model.dateTime().nullable(),
    last_checked_at: model.dateTime().nullable(),
    expires_at: model.dateTime().nullable(),
    production_order: model.belongsTo(() => ProductionOrder, {
      mappedBy: "payment_requests",
    }),
  }
)
