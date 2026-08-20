import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { balancePaymentUrl } from "../lib/balance-payment-link";
import { accountOrderLink } from "../lib/storefront-url";
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
        // How the order is being paid — the confirmation's „Platba" row.
        // Dobírka in particular must say „zaplatíte při převzetí", or the
        // customer stands at the door not knowing they owe money.
        "payment_collections.payment_sessions.provider_id",
        "payment_collections.payment_sessions.status",
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
      ({ id, orders, balance }) => {
        // The payment sessions carry the provider id; the e-mail needs the
        // customer's words for it. Cancelled sessions are leftovers of a
        // switched payment method and say nothing about how this order pays.
        const sessions = ((orders[0] as any).payment_collections ?? []).flatMap(
          (collection: any) => collection?.payment_sessions ?? []
        )
        const providerIds = sessions
          .filter((session: any) => session?.status !== "canceled")
          .map((session: any) => String(session?.provider_id ?? ""))

        const payment_method = providerIds.some((providerId: string) =>
          providerId.startsWith("pp_dobirka")
        )
          ? "Dobírka — zaplatíte při převzetí"
          : providerIds.some((providerId: string) =>
                providerId.startsWith("pp_comgate")
              )
            ? "Online platba kartou"
            : undefined

        return [
          {
            to: orders[0].email,
            channel: "email",
            template: "order-placed",
            idempotency_key: `order-placed:${id}`,
            data: {
              order: orders[0],
              balance_due: balance.outstanding,
              balance_currency: balance.currency_code,
              ...(payment_method ? { payment_method } : {}),
              // Signed, so the customer can pay from the e-mail without an
              // account. Absent when nothing is owed.
              edit_order_url: accountOrderLink(id),
              balance_payment_url: balance.outstanding > 0
                ? balancePaymentUrl(id)
                : null,
            },
          },
        ]
      }
    )

    const notification = sendNotificationStep(notificationData)

    return new WorkflowResponse(notification)
  }
)