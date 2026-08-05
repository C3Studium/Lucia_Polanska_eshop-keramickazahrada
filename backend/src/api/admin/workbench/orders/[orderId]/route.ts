import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MERCHANT_ORDER_MODULE } from "../../../../../modules/merchant-order"
import type MerchantOrderModuleService from "../../../../../modules/merchant-order/service"

/**
 * One order, expanded — the ledger, the timeline, the e-mails
 * (Objednávky+ row expansion; admin-advanced-plan.md, depth level 4).
 *
 * Three questions a phone call asks that the row cannot answer:
 * „kdy jste mi co poslali?" (notifications for this order), „co se s tím
 * dělo?" (the stage history appended by every transition), and „co přesně
 * jste mi účtovali?" (per-payment ledger, not the aggregate). The native
 * order detail has pieces of this; it does not have the merchant timeline,
 * and switching pages mid-call is how the answer gets guessed instead of
 * read.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.orderId
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const merchantOrders = req.scope.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )

  const [{ data: orders }, states, { data: notifications }] =
    await Promise.all([
      query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "email",
          "currency_code",
          "items.id",
          "items.title",
          "items.quantity",
          "items.unit_price",
          "items.total",
          "payment_collections.payments.id",
          "payment_collections.payments.amount",
          "payment_collections.payments.provider_id",
          "payment_collections.payments.created_at",
          "payment_collections.payments.captured_at",
          "payment_collections.payments.refunds.amount",
          "payment_collections.payments.refunds.created_at",
        ],
        filters: { id: orderId },
      }),
      merchantOrders.listMerchantOrderStates({
        order_id: orderId,
      } as never) as Promise<any[]>,
      query.graph({
        entity: "notification",
        fields: [
          "id",
          "to",
          "channel",
          "template",
          "status",
          "created_at",
        ],
        filters: { resource_id: orderId } as never,
        pagination: { take: 50, skip: 0 },
      }).catch(() => ({ data: [] })),
    ])

  const order = orders[0] as any

  if (!order) {
    res.status(404).json({ message: "Objednávka nebyla nalezena." })
    return
  }

  const state = (states as any[])[0] ?? null

  // The order's e-mails: notifications keyed to the order, plus anything
  // sent straight to the order's address (some sends carry no resource_id).
  let emails = (notifications as any[]) ?? []
  if (!emails.length && order.email) {
    const fallback = await query
      .graph({
        entity: "notification",
        fields: ["id", "to", "channel", "template", "status", "created_at"],
        filters: { to: order.email } as never,
        pagination: { take: 50, skip: 0 },
      })
      .catch(() => ({ data: [] as any[] }))
    emails = fallback.data as any[]
  }

  const payments = (order.payment_collections ?? []).flatMap(
    (collection: any) => collection?.payments ?? []
  )

  res.status(200).json({
    id: order.id,
    display_id: order.display_id,
    currency_code: order.currency_code,
    items: (order.items ?? []).map((item: any) => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      total: Number(item.total) || 0,
    })),
    ledger: payments.map((payment: any) => ({
      id: payment.id,
      provider_id: payment.provider_id,
      amount: Number(payment.amount) || 0,
      created_at: payment.created_at,
      captured_at: payment.captured_at,
      refunded: (payment.refunds ?? []).reduce(
        (sum: number, refund: any) => sum + (Number(refund.amount) || 0),
        0
      ),
    })),
    stage: state?.stage ?? null,
    internal_note: state?.internal_note ?? null,
    timeline: Array.isArray(state?.stage_history) ? state.stage_history : [],
    emails: emails
      .filter((notification: any) => notification.channel === "email")
      .map((notification: any) => ({
        template: notification.template,
        status: notification.status,
        created_at: notification.created_at,
      })),
  })
}
