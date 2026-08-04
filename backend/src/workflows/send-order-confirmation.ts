import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { balancePaymentUrl } from "../lib/balance-payment-link";
import { resolveBalanceStep } from "./steps/resolve-balance";
import { sendNotificationStep } from "./steps/send-notification";

type WorkflowInput = {
  id: string
}

export const sendOrderConfirmationWorkflow = createWorkflow(
  "send-order-confirmation",
  ({ id }: WorkflowInput) => {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "items.*",
        "shipping_address.*",
        "billing_address.*",
        "shipping_methods.*",
        "customer.*",
        "total",
        "subtotal",
        "discount_total",
        "shipping_total",
        "tax_total",
        "item_subtotal",
        "item_total",
        "item_tax_total",
      ],
      filters: {
        id
      }
    }).config({ name: "get-order-confirmation-details" })
    
    // Keyed per order so at-least-once event delivery cannot send a second
    // confirmation. This matters more now that a failed send is recorded as a
    // failure and therefore retried: without the key, every retry would be a
    // brand-new e-mail rather than another attempt at the same one.
    //
    // The payload is built inside `transform` because `id` and `orders` are
    // not values here — they are placeholders for values the workflow will
    // have when it *runs*. Interpolating one into a template literal at
    // composition time coerces the placeholder to a primitive and throws
    // "object is not a function" while the module is still being imported,
    // which takes the whole server down at boot. Property access
    // (`orders[0].email`) is fine; string building is not.
    // Whether this order still owes money, and how much. A commission paid
    // only as a deposit does; one paid in full does not, and must not be shown
    // a "pay the rest" button for zero.
    const balance = resolveBalanceStep({ order_id: id })

    const notificationData = transform(
      { id, orders, balance },
      ({ id, orders, balance }) => [
        {
          to: orders[0].email,
          channel: "email",
          template: "order-placed",
          idempotency_key: `order-placed:${id}`,
          data: {
            order: orders[0],
            balance_due: balance.outstanding,
            balance_currency: balance.currency_code,
            // Signed, so the customer can pay from the e-mail without an
            // account. Absent when nothing is owed.
            balance_payment_url: balance.outstanding > 0
              ? balancePaymentUrl(id)
              : null,
          },
        },
      ]
    )

    const notification = sendNotificationStep(notificationData)

    return new WorkflowResponse(notification)
  }
)