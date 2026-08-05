import { model } from "@medusajs/framework/utils"

/**
 * A customer's request to return something, before any native Medusa return
 * exists (WorkflowPlan.md — returns intake).
 *
 * Today returns are agreed over e-mail; this row is that conversation's front
 * door. It deliberately stores a *snapshot* of the order facts it needs
 * (`order_display_id`, `email`, `customer_name`) so the decision e-mails can be
 * sent from the request alone, without re-deriving who asked.
 */
const ReturnRequest = model.define("return_request", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  order_display_id: model.text(),
  email: model.text(),
  customer_name: model.text().nullable(),
  reason: model.text(),
  /** The customer's own free-text list of what they want to send back. */
  items: model.json().nullable(),
  status: model
    .enum(["pending", "approved", "rejected"])
    .index()
    .default("pending"),
  /** Her words on the decision — for a rejection, the customer sees them. */
  decision_note: model.text().nullable(),
  decided_at: model.dateTime().nullable(),
})
  .indexes([
    {
      on: ["order_id"],
    },
  ])

export default ReturnRequest
