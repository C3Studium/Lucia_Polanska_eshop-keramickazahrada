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
          "customer.id",
          "shipping_address.first_name",
          "shipping_address.last_name",
          "shipping_address.address_1",
          "shipping_address.city",
          "shipping_address.postal_code",
          "shipping_methods.name",
          "items.id",
          "items.title",
          "items.thumbnail",
          "items.variant_title",
          "items.quantity",
          "items.unit_price",
          "items.total",
          "items.metadata",
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

  // The customer block — Matěj's OrcaSlicer level: the expansion answers
  // „kdo to je?" before she asks it. Other orders by the same person (by
  // customer id when there is one, else by e-mail, so guest history counts),
  // newest first, excluding this order.
  let customerHistory: any[] = []
  if (order.customer?.id || order.email) {
    // E-mail first, id as a supplement, both merged: guest checkouts mint a
    // NEW customer record per order, so matching by customer_id alone told a
    // fifty-order regular „first order u vás". The person is the e-mail.
    const [byEmail, byId] = await Promise.all([
      order.email
        ? query
            .graph({
              entity: "order",
              fields: ["id", "display_id", "created_at", "total", "customer_id", "email"],
              filters: { email: order.email } as never,
              pagination: { take: 50, skip: 0, order: { created_at: "DESC" } },
            })
            .catch(() => ({ data: [] as any[] }))
        : { data: [] as any[] },
      order.customer?.id
        ? query
            .graph({
              entity: "order",
              fields: ["id", "display_id", "created_at", "total", "customer_id", "email"],
              filters: { customer_id: order.customer.id } as never,
              pagination: { take: 50, skip: 0, order: { created_at: "DESC" } },
            })
            .catch(() => ({ data: [] as any[] }))
        : { data: [] as any[] },
    ])
    const seen = new Map<string, any>()
    for (const row of [...(byEmail.data as any[]), ...(byId.data as any[])]) {
      seen.set(row.id, row)
    }
    const others = [...seen.values()].sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1
    )

    const otherIds = (others as any[])
      .filter((other) => other.id !== order.id)
      .map((other) => other.id)
    const otherStates = otherIds.length
      ? ((await merchantOrders.listMerchantOrderStates({
          order_id: otherIds,
        } as never)) as any[])
      : []
    const stageByOrder = new Map(
      otherStates.map((entry) => [entry.order_id, entry.stage])
    )

    customerHistory = (others as any[])
      .filter((other) => other.id !== order.id)
      .map((other) => ({
        id: other.id,
        display_id: other.display_id,
        created_at: other.created_at,
        total: Number(other.total) || 0,
        stage: stageByOrder.get(other.id) ?? null,
      }))
  }

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
    customer: {
      id: order.customer?.id ?? null,
      email: order.email,
      previous_orders: customerHistory.length,
      history: customerHistory.slice(0, 5),
    },
    shipping: {
      name:
        [
          order.shipping_address?.first_name,
          order.shipping_address?.last_name,
        ]
          .filter(Boolean)
          .join(" ") || null,
      address: [
        order.shipping_address?.address_1,
        order.shipping_address?.postal_code,
        order.shipping_address?.city,
      ]
        .filter(Boolean)
        .join(", ") || null,
      method: (order.shipping_methods ?? [])[0]?.name ?? null,
    },
    items: (order.items ?? []).map((item: any) => ({
      id: item.id,
      title: item.title,
      variant_title: item.variant_title ?? null,
      thumbnail: item.thumbnail ?? null,
      quantity: item.quantity,
      unit_price: Number(item.unit_price) || 0,
      total: Number(item.total) || 0,
      specification:
        (item.metadata as any)?.made_to_order?.specification ?? null,
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
