import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { orderLink } from "../../../../../lib/storefront-url"
import { formatMoney } from "../../../../../lib/customer-email"

/**
 * The „one click" the customer-edit flow promises: returns the recorded
 * `refund_due` difference (also written by a cancelled, deposit-paid zakázka).
 *
 * Card payments refund through ComGate via the core refund workflow (the
 * provider is idempotent and over-refund-guarded). Cash flows — dobírka,
 * personal pickup — have no wire to send money back through, so the action
 * records that she settles it by hand and clears the debt the same way.
 * Either way the customer gets the „vrácení peněz" e-mail and the queue stops
 * showing the button.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "metadata",
      "customer.first_name",
      "payment_collections.payments.id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.canceled_at",
    ],
    filters: { id: req.params.orderId },
  })
  const order = orders[0] as any
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }

  const metadata = (order.metadata ?? {}) as Record<string, any>
  const due = metadata.refund_due
  if (!due || !(Number(due.amount) > 0)) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "U téhle objednávky není evidovaný žádný rozdíl k vrácení."
    )
  }
  const amount = Number(due.amount)

  const payments = (order.payment_collections ?? []).flatMap(
    (collection: any) => collection?.payments ?? []
  )
  const cardPayment = payments.find(
    (payment: any) =>
      payment?.provider_id === "pp_comgate_comgate" &&
      payment?.captured_at &&
      !payment?.canceled_at
  )

  let method: "comgate" | "manual" = "manual"
  if (cardPayment) {
    await refundPaymentWorkflow(req.scope).run({
      input: {
        payment_id: cardPayment.id,
        amount,
        note: `Vrácení rozdílu po úpravě objednávky #${order.display_id}`,
      } as never,
    })
    method = "comgate"
  }

  // The debt is settled — clear it and keep the receipt in the same metadata.
  const history = Array.isArray(metadata.refund_history)
    ? metadata.refund_history
    : []
  const orderModule = req.scope.resolve(Modules.ORDER) as any
  await orderModule.updateOrders([
    {
      id: order.id,
      metadata: {
        ...metadata,
        refund_due: null,
        refund_history: [
          ...history,
          {
            amount,
            currency_code: due.currency_code ?? order.currency_code,
            reason: due.reason ?? "customer_edit",
            method,
            refunded_at: new Date().toISOString(),
          },
        ],
      },
    },
  ])

  if (order.email) {
    const notifications = req.scope.resolve(Modules.NOTIFICATION)
    await notifications
      .createNotifications({
        to: order.email,
        channel: "email",
        template: "order-refunded",
        data: {
          customerName: order.customer?.first_name ?? undefined,
          orderNumber: `#${order.display_id}`,
          // The template renders strings — a raw `amount` number used to be
          // ignored and the mail fell back to a mock „1 250 Kč".
          refundAmount: formatMoney(
            amount,
            due.currency_code ?? order.currency_code
          ),
          refundReason:
            due.reason === "mto_cancelled"
              ? "Zrušená zakázka"
              : "Vrácení rozdílu po úpravě objednávky",
          orderLink: orderLink(order) || undefined,
        },
        idempotency_key: `refund-difference:${order.id}:${history.length}`,
      } as never)
      .catch(() => {
        // The refund itself succeeded — a failed mail shows in Přehled → E-maily.
      })
  }

  res.status(200).json({
    refunded: true,
    method,
    amount,
    message:
      method === "comgate"
        ? `Vráceno ${amount} Kč na kartu přes ComGate.`
        : `Zaznamenáno ${amount} Kč k ručnímu vrácení (objednávka nebyla placená kartou).`,
  })
}
