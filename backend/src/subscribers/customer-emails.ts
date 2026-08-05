import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  customerName,
  formatMoney,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../lib/customer-email"
import { balancePaymentUrl } from "../lib/balance-payment-link"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"

/**
 * The customer lifecycle e-mails (WorkflowPlan.md §16).
 *
 * Twelve Czech templates existed in this repo and none of them were ever sent.
 * A customer paid and heard nothing; their order shipped and they heard
 * nothing; they owed a balance and got no link, because the event that should
 * have sent it — `made-to-order.balance-requested` — had no subscriber at all.
 * This file is what makes the shop talk.
 *
 * Every handler is idempotent through its §16 dedupe key, because event
 * delivery is at-least-once and a duplicate here lands in somebody's inbox.
 *
 * ## What deliberately does *not* send
 *
 * „Připravujeme" for an ordinary order (§16: noise — she packs within a day and
 * the customer does not need a progress report), anything claiming delivery
 * without a real signal, and reminders of any kind (D4 — the balance flow is
 * manual, the system only ever notifies *her*).
 */

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "total",
  "items.*",
  "customer.first_name",
  "customer.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_methods.name",
  "shipping_methods.data",
]

const loadOrder = async (container: SubscriberArgs["container"], orderId: string) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  })
  return (data[0] as any) ?? null
}

const common = (order: any) => ({
  customerName: customerName(order),
  orderNumber: orderNumber(order),
  orderLink: orderLink(order),
})

/**
 * #2 „Platba přijata".
 *
 * Skipped when the capture happened within five minutes of the order being
 * placed: the confirmation e-mail already said „děkujeme za objednávku", and a
 * second mail a few seconds later saying „děkujeme za platbu" reads like a
 * system with a stutter. It only earns its place when the money arrives
 * *later* than the order — a balance, a retried card, a bank transfer.
 */
const onPaymentCaptured = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  if (!data?.id) {
    return
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: payments } = await query.graph({
    entity: "payment",
    fields: [
      "id",
      "amount",
      "currency_code",
      "captured_at",
      "provider_id",
      "payment_collection.order.id",
      "payment_collection.order.created_at",
    ],
    filters: { id: data.id },
  })
  const payment = payments[0] as any
  const orderRef = payment?.payment_collection?.order
  if (!orderRef?.id) {
    return
  }

  const placedAt = new Date(orderRef.created_at).getTime()
  const capturedAt = new Date(payment.captured_at ?? Date.now()).getTime()
  if (Number.isFinite(placedAt) && capturedAt - placedAt < 5 * 60 * 1000) {
    return
  }

  const order = await loadOrder(container, orderRef.id)
  if (!order) {
    return
  }

  await sendCustomerEmail(container, {
    template: "payment-received",
    to: order.email,
    key: `payment-received:${payment.id}`,
    orderId: order.id,
    data: {
      ...common(order),
      paymentAmount: formatMoney(payment.amount, payment.currency_code),
      paymentMethod: "Online platba",
    },
  })
}

/**
 * #4 „Prosíme o doplatek" — the dead event, finally subscribed.
 *
 * `made-to-order.balance-requested` has been emitted at two places in the
 * actions route since the module was written, with nothing listening. Every
 * customer who was asked for a balance was asked by hand, or not at all.
 */
const onBalanceRequested = async ({
  event: { data },
  container,
}: SubscriberArgs<{ order_id: string; payment_request_id: string }>) => {
  if (!data?.order_id || !data?.payment_request_id) {
    return
  }

  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const [request] = (await madeToOrder.listProductionPaymentRequests({
    id: data.payment_request_id,
  } as never)) as any[]

  const order = await loadOrder(container, data.order_id)
  if (!order || !request) {
    return
  }

  await sendCustomerEmail(container, {
    template: "payment-pending",
    to: order.email,
    // Keyed on the request, so re-sending the same link — which is what
    // „Připomenout" does — never produces a second e-mail.
    key: `paylink:${request.id}`,
    orderId: order.id,
    data: {
      ...common(order),
      paymentAmount: formatMoney(request.amount, request.currency_code),
      paymentMethod: "Platební karta nebo převod",
      // The link she generated, or the signed one that works from any inbox.
      orderLink: request.payment_url || balancePaymentUrl(order.id) || orderLink(order),
      estimatedConfirmationTime: "Platba se obvykle potvrdí do několika minut.",
    },
  })
}

/** #10 „Doplatek přijat". */
const onBalancePaid = async ({
  event: { data },
  container,
}: SubscriberArgs<{
  order_id: string
  payment_request_id: string
  amount?: number
  currency_code?: string
}>) => {
  if (!data?.order_id || !data?.payment_request_id) {
    return
  }
  const order = await loadOrder(container, data.order_id)
  if (!order) {
    return
  }

  await sendCustomerEmail(container, {
    template: "payment-received",
    to: order.email,
    key: `balpaid:${data.payment_request_id}`,
    orderId: order.id,
    data: {
      ...common(order),
      paymentAmount: formatMoney(data.amount, data.currency_code),
      paymentMethod: "Doplatek",
    },
  })
}

const isPickupOrder = (order: any): boolean =>
  (order.shipping_methods || []).some(
    (method: any) => method?.data?.personal_pickup === true
  )

const loadFulfillmentOrder = async (
  container: SubscriberArgs["container"],
  fulfillmentId: string
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: [
      "id",
      "order.id",
      "data",
      "labels.tracking_number",
      "labels.tracking_url",
    ],
    filters: { id: fulfillmentId },
  })
  const fulfillment = fulfillments[0] as any
  const orderId = fulfillment?.order?.id
  if (!orderId) {
    return { fulfillment: null, order: null }
  }
  return { fulfillment, order: await loadOrder(container, orderId) }
}

/**
 * #11 „Objednávka odeslána" — and for personal pickup „Připraveno k vyzvednutí".
 *
 * The tracking CTA is included **only when a tracking number exists**. §16 is
 * explicit: no tracking means the e-mail goes without the button, never with a
 * link that goes nowhere. In record-only carrier mode there is never one.
 *
 * A pickup order's shipment being created means she has packed it — the goods
 * are *ready*, not handed over, so the customer is invited to collect. The
 * handover itself is `delivery.created` below.
 */
const onShipmentCreated = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  if (!data?.id) {
    return
  }
  const { fulfillment, order } = await loadFulfillmentOrder(container, data.id)
  if (!fulfillment || !order) {
    return
  }

  if (isPickupOrder(order)) {
    await sendCustomerEmail(container, {
      template: "order-ready-pickup",
      to: order.email,
      key: `ship:${fulfillment.id}`,
      orderId: order.id,
      data: {
        ...common(order),
        pickupLocation: "Ateliér Keramická zahrada",
        pickupAddress: "Putim 229, 397 01 Písek",
        readyDate: new Date().toLocaleDateString("cs-CZ"),
      },
    })
    return
  }

  const label = (fulfillment.labels || [])[0]

  await sendCustomerEmail(container, {
    template: "order-shipment",
    to: order.email,
    key: `ship:${fulfillment.id}`,
    orderId: order.id,
    data: {
      ...common(order),
      carrierName: (order.shipping_methods || [])[0]?.name ?? "Česká pošta",
      trackingNumber: label?.tracking_number ?? "",
      trackingLink: label?.tracking_url ?? "",
    },
  })
}

/**
 * „Objekty jsou u vás" — sent when the fulfillment is marked as delivered,
 * which for a pickup order is the actual handover. Only pickup orders: a
 * courier delivery is announced by the carrier, and a second mail from us
 * claiming the same thing would be noise (§16).
 */
const onDeliveryCreated = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  if (!data?.id) {
    return
  }
  const { fulfillment, order } = await loadFulfillmentOrder(container, data.id)
  if (!fulfillment || !order || !isPickupOrder(order)) {
    return
  }

  await sendCustomerEmail(container, {
    template: "order-delivered",
    to: order.email,
    key: `deliver:${fulfillment.id}`,
    orderId: order.id,
    data: { ...common(order) },
  })
}

/** #15 „Objednávka zrušena". */
const onOrderCanceled = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  if (!data?.id) {
    return
  }
  const order = await loadOrder(container, data.id)
  if (!order) {
    return
  }

  await sendCustomerEmail(container, {
    template: "order-cancelled",
    to: order.email,
    key: `cancel:${order.id}`,
    orderId: order.id,
    data: { ...common(order) },
  })
}

/**
 * #16 „Vracíme peníze".
 *
 * §16 collapses „refund started" and „refund completed" into one mail on
 * purpose: a ComGate refund is a single step, so two e-mails would describe a
 * process that does not exist.
 */
const onPaymentRefunded = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  if (!data?.id) {
    return
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: payments } = await query.graph({
    entity: "payment",
    fields: [
      "id",
      "amount",
      "currency_code",
      "refunds.amount",
      "payment_collection.order.id",
    ],
    filters: { id: data.id },
  })
  const payment = payments[0] as any
  const orderId = payment?.payment_collection?.order?.id
  if (!orderId) {
    return
  }

  const order = await loadOrder(container, orderId)
  if (!order) {
    return
  }

  const refunded = (payment.refunds || []).reduce(
    (sum: number, refund: any) => sum + Number(refund?.amount ?? 0),
    0
  )

  await sendCustomerEmail(container, {
    template: "payment-refunded",
    to: order.email,
    key: `refund:${payment.id}`,
    orderId: order.id,
    data: {
      ...common(order),
      refundAmount: formatMoney(refunded, payment.currency_code),
      originalPaymentAmount: formatMoney(payment.amount, payment.currency_code),
      refundMethod: "Zpět na účet, ze kterého platba přišla",
      estimatedRefundTime: "Peníze se obvykle vrátí do několika pracovních dnů.",
    },
  })
}

/** #6 „Zadání potvrzeno — začínáme". */
const onSpecificationConfirmed = async ({
  event: { data },
  container,
}: SubscriberArgs<{ order_id: string; production_order_id: string }>) => {
  if (!data?.order_id) {
    return
  }
  const order = await loadOrder(container, data.order_id)
  if (!order) {
    return
  }

  await sendCustomerEmail(container, {
    template: "order-processing",
    to: order.email,
    key: `spec-ok:${data.production_order_id ?? order.id}`,
    orderId: order.id,
    data: {
      ...common(order),
      estimatedProcessingTime:
        "Jakmile bude hotovo, dáme vám vědět a domluvíme se na odeslání.",
    },
  })
}

const handlers: Record<string, (args: SubscriberArgs<any>) => Promise<void>> = {
  "payment.captured": onPaymentCaptured,
  "made-to-order.balance-requested": onBalanceRequested,
  "made-to-order.balance-paid": onBalancePaid,
  "made-to-order.specification-confirmed": onSpecificationConfirmed,
  "shipment.created": onShipmentCreated,
  "delivery.created": onDeliveryCreated,
  "order.canceled": onOrderCanceled,
  "payment.refunded": onPaymentRefunded,
}

export default async function customerEmails(args: SubscriberArgs<any>) {
  const handler = handlers[args.event.name]
  if (handler) {
    await handler(args)
  }
}

export const config: SubscriberConfig = {
  event: [
    "payment.captured",
    "made-to-order.balance-requested",
    "made-to-order.balance-paid",
    "made-to-order.specification-confirmed",
    "shipment.created",
    "delivery.created",
    "order.canceled",
    "payment.refunded",
  ],
}
