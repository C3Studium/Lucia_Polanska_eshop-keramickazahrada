import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getLastPaymentStatus } from "@medusajs/medusa/core-flows"
import { notifyMerchant } from "../lib/notify"
import { isPaymentProblem } from "../modules/merchant-order/payment-state"

/**
 * Merchant awareness — the first five notifications of WorkflowPlan.md §15.
 *
 * Until now the admin told her nothing: the bell had no provider behind it and
 * no merchant e-mail existed anywhere. These handlers turn events that already
 * happen into „someone should look at this".
 *
 * Every handler is a *reflection* of an event and changes no state, so they are
 * safe to re-run — and the §15 dedupe key means at-least-once delivery cannot
 * produce a second bell entry.
 *
 * Covered here: #1 new paid order, #3 new commission, #7 balance received,
 * #9 ready to ship, #14 review awaiting approval. The rest arrive with the jobs
 * that detect them (P3, P6, P7, P9).
 */

const formatMoney = (amount: unknown, currencyCode?: string | null): string => {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) {
    return "—"
  }
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: (currencyCode || "CZK").toUpperCase(),
  }).format(numeric)
}

const customerName = (order: any): string => {
  const first = order?.customer?.first_name || order?.shipping_address?.first_name
  const last = order?.customer?.last_name || order?.shipping_address?.last_name
  const name = [first, last].filter(Boolean).join(" ").trim()
  return name || order?.email || "Zákazník"
}

/**
 * Made-to-order is detected from the payment collection rather than from the
 * `production_order` row, because the subscriber that creates that row listens
 * to the very same `order.placed` event — subscriber ordering is not guaranteed,
 * so reading its output here would be a race.
 */
const isMadeToOrder = (order: any): boolean =>
  (order?.payment_collections || []).some((collection: any) => {
    const lines = collection?.metadata?.production_lines
    return Boolean(collection?.metadata?.made_to_order) && Array.isArray(lines) && lines.length
  })

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
  "payment_collections.*",
  "payment_collections.payments.*",
]

/**
 * #1 „Nová zaplacená objednávka" and #3 „Nové zadání zakázky".
 *
 * Both hang off `order.placed`, and a made-to-order order produces both: the
 * order still has to be packed and shipped, and the commission still has to be
 * read and confirmed.
 */
const onOrderPlaced = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // `items.*` is required for `total` to be computed at all — a projection
  // without it silently yields zero.
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: data.id },
  })
  const order = orders[0]
  if (!order) {
    return
  }

  // The computed payment status lives in Medusa's own aggregation, not on the
  // order row. Unpaid orders are announced by the payment-problem notification
  // (#2, P6), not as a new sale.
  const paymentStatus = getLastPaymentStatus({
    currency_code: order.currency_code,
    payment_collections: order.payment_collections || [],
  } as any)

  const itemCount = (order.items || []).length

  if (!isPaymentProblem(paymentStatus)) {
    await notifyMerchant(container, {
      key: `mn:new-order:${order.id}`,
      title: `Nová zaplacená objednávka #${order.display_id}`,
      description: `${customerName(order)} · ${formatMoney(
        order.total,
        order.currency_code
      )} · ${itemCount} ${itemCount === 1 ? "položka" : itemCount < 5 ? "položky" : "položek"}`,
      audience: "owner",
      // D7: she works from her inbox, so this one is a bell entry *and* an
      // e-mail even though it is not urgent.
      email: true,
      resource: { id: order.id, type: "order" },
    })
  }

  if (isMadeToOrder(order)) {
    await notifyMerchant(container, {
      key: `mn:mto-new:${order.id}`,
      title: `Nová zakázka #${order.display_id} — přečtěte si zadání`,
      description: `${customerName(order)} si objednal(a) výrobu na míru. Zadání najdete v Zakázkách.`,
      audience: "owner",
      // D7 again: a commission is a "must read soon" item and she works from
      // her inbox, so it goes to e-mail exactly like a new paid order does.
      email: true,
      resource: { id: order.id, type: "order" },
    })
  }
}

/**
 * #9 „Objednávka připravena k odeslání" — the queue reached K odeslání, whether
 * she moved it there or a fulfilment created on the native page did.
 */
const onStageChanged = async ({
  event: { data },
  container,
}: SubscriberArgs<{ order_id: string; stage: string }>) => {
  if (data?.stage !== "shipping" || !data.order_id) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id"],
    filters: { id: data.order_id },
  })
  const order = orders[0]
  if (!order) {
    return
  }

  await notifyMerchant(container, {
    key: `mn:ready:${order.id}`,
    title: `Objednávka #${order.display_id} je připravená k odeslání`,
    description: "Najdete ji v Denní práci → K odeslání.",
    audience: "owner",
    resource: { id: order.id, type: "order" },
  })
}

/**
 * #7 „Doplatek přijat" — D4 makes this the moment she has been waiting for, so
 * it goes to her inbox as well as the bell.
 */
const onBalancePaid = async ({
  event: { data },
  container,
}: SubscriberArgs<{
  order_id: string
  payment_request_id: string
  amount?: number
  currency_code?: string
}>) => {
  if (!data?.payment_request_id) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = data.order_id
    ? await query.graph({
        entity: "order",
        fields: ["id", "display_id"],
        filters: { id: data.order_id },
      })
    : { data: [] as any[] }
  const order = orders[0]

  await notifyMerchant(container, {
    key: `mn:balpaid:${data.payment_request_id}`,
    title: order
      ? `Doplatek u zakázky #${order.display_id} přijat`
      : "Doplatek přijat",
    description: `${formatMoney(
      data.amount,
      data.currency_code
    )} dorazilo. Zakázku můžete odeslat.`,
    audience: "owner",
    email: true,
    ...(order ? { resource: { id: order.id, type: "order" } } : {}),
  })
}

/** #14 „Recenze ke schválení" — D5 keeps every review manually moderated. */
const onReviewCreated = async ({
  event: { data },
  container,
}: SubscriberArgs<{
  id: string
  rating?: number
  product_title?: string | null
}>) => {
  if (!data?.id) {
    return
  }

  const rating = Number(data.rating)
  const stars = Number.isFinite(rating) ? `★${rating}` : ""
  const product = data.product_title ? ` — ${data.product_title}` : ""

  await notifyMerchant(container, {
    key: `mn:review:${data.id}`,
    title: `Nová recenze ke schválení ${stars}${product}`.trim(),
    description: "Schvalte nebo zamítněte ji v sekci Recenze.",
    audience: "owner",
    resource: { id: data.id, type: "review" },
  })
}

/**
 * One file, one exported handler per Medusa's subscriber contract — so the
 * handlers are dispatched by event name here.
 */
const handlers: Record<string, (args: SubscriberArgs<any>) => Promise<void>> = {
  "order.placed": onOrderPlaced,
  "merchant-order.stage-changed": onStageChanged,
  "made-to-order.balance-paid": onBalancePaid,
  "review.created": onReviewCreated,
}

export default async function merchantNotifications(args: SubscriberArgs<any>) {
  const handler = handlers[args.event.name]
  if (handler) {
    await handler(args)
  }
}

export const config: SubscriberConfig = {
  event: [
    "order.placed",
    "merchant-order.stage-changed",
    "made-to-order.balance-paid",
    "review.created",
  ],
}
