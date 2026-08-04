import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MERCHANT_ORDER_MODULE } from "../modules/merchant-order"
import MerchantOrderModuleService from "../modules/merchant-order/service"
import type { MerchantOrderStage } from "../modules/merchant-order/stages"
import { transitionMerchantOrderWorkflow } from "../workflows/transition-merchant-order"

/**
 * Keeps the merchant queue honest about what Medusa has actually done.
 *
 * Before this existed the sync was one-way and incomplete: clicking "Odesláno" did not
 * fulfil anything, and fulfilling on the native order page did not move the order out of
 * the queue. The two views could disagree indefinitely.
 *
 * Every handler here is a *reflection* of a native event, never a decision. That is why
 * the transitions run with `reconcile: true` — they report a fact rather than request a
 * merchant action, so they are not bound by the merchant transition table.
 *
 * All handlers are idempotent: the transition step short-circuits when the stage already
 * matches, which matters because event delivery is at-least-once.
 */

const stageFor = async (
  container: SubscriberArgs["container"],
  orderId: string
): Promise<MerchantOrderStage | null> => {
  const service = container.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )
  const states = await service.listMerchantOrderStates({ order_id: orderId })
  return (states[0]?.stage as MerchantOrderStage) ?? null
}

const reconcile = async (
  container: SubscriberArgs["container"],
  orderId: string,
  stage: MerchantOrderStage
) => {
  await transitionMerchantOrderWorkflow(container).run({
    input: { order_id: orderId, stage, reconcile: true },
  })
}

/**
 * A fulfilment exists, so the goods are packed. The order belongs in "K odeslání" at the
 * latest — but never drag it backwards out of `shipped`, and never out of a terminal stage.
 */
const onFulfillmentCreated = async (
  container: SubscriberArgs["container"],
  data: { order_id?: string }
) => {
  if (!data?.order_id) {
    return
  }
  const stage = await stageFor(container, data.order_id)
  if (stage === null || ["shipping", "shipped", "cancelled"].includes(stage)) {
    return
  }
  await reconcile(container, data.order_id, "shipping")
}

/**
 * A shipment exists, so the goods have left. This fires both when the merchant used the
 * one-click action and when they fulfilled manually on the native order page.
 */
const onShipmentCreated = async (
  container: SubscriberArgs["container"],
  data: { id?: string }
) => {
  if (!data?.id) {
    return
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  // `fulfillment -> order` is the traversable direction of the native order-fulfillment
  // link; the shipment event only carries the fulfilment id.
  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "order.id"],
    filters: { id: data.id },
  })
  const orderId = (fulfillments[0] as any)?.order?.id
  if (!orderId) {
    return
  }
  const stage = await stageFor(container, orderId)
  if (stage === null || stage === "cancelled") {
    return
  }
  await reconcile(container, orderId, "shipped")
}

/**
 * The fulfilment was cancelled natively. If nothing is left in flight the order has to
 * come back into the working queue, otherwise it sits in "Odesláno" claiming to be gone.
 */
const onFulfillmentCanceled = async (
  container: SubscriberArgs["container"],
  data: { order_id?: string }
) => {
  if (!data?.order_id) {
    return
  }
  const stage = await stageFor(container, data.order_id)
  if (stage === null || stage === "cancelled") {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "fulfillments.id", "fulfillments.canceled_at"],
    filters: { id: data.order_id },
  })
  const hasActiveFulfillment = ((orders[0] as any)?.fulfillments || []).some(
    (fulfillment: any) => !fulfillment?.canceled_at
  )
  if (hasActiveFulfillment) {
    return
  }
  await reconcile(container, data.order_id, "working")
}

/**
 * A payment was captured. If the order was parked in the problem queue, the problem is
 * over — the merchant should not have to notice and clear it by hand.
 */
const onPaymentCaptured = async (
  container: SubscriberArgs["container"],
  data: { id?: string }
) => {
  if (!data?.id) {
    return
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  // `payment -> payment_collection -> order` is the traversable direction; the capture
  // event carries only the payment id.
  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["id", "payment_collection.order.id"],
    filters: { id: data.id },
  })
  const orderId = (payments[0] as any)?.payment_collection?.order?.id
  if (!orderId) {
    return
  }
  const stage = await stageFor(container, orderId)
  if (stage !== "payment_problem") {
    return
  }
  await reconcile(container, orderId, "received")
}

/**
 * The order was cancelled — natively, or from the queue's own „Zrušit objednávku".
 *
 * `cancelled` is an outcome rather than a queue (`MERCHANT_ORDER_ACTIVE_STAGES`
 * excludes it), so this is what actually removes an order from the merchant's day.
 * Without it a cancelled order kept sitting in „Nové" asking to be packed.
 *
 * Nothing is reopened: an order that already shipped cannot be un-shipped by a
 * cancellation event, and re-cancelling is a no-op because the transition step
 * short-circuits when the stage already matches.
 */
const onOrderCanceled = async (
  container: SubscriberArgs["container"],
  data: { id?: string }
) => {
  if (!data?.id) {
    return
  }
  const stage = await stageFor(container, data.id)
  if (stage === null || stage === "cancelled" || stage === "shipped") {
    return
  }
  await reconcile(container, data.id, "cancelled")
}

/**
 * One subscriber for the whole reflection surface. Dispatching on `event.name` keeps the
 * related rules in a single place instead of four near-identical files.
 */
export default async function reconcileMerchantOrder({
  event,
  container,
}: SubscriberArgs<Record<string, any>>) {
  const data = (event.data || {}) as Record<string, any>

  switch (event.name) {
    case "order.fulfillment_created":
      return onFulfillmentCreated(container, data)
    case "shipment.created":
      return onShipmentCreated(container, data)
    case "order.fulfillment_canceled":
      return onFulfillmentCanceled(container, data)
    case "payment.captured":
      return onPaymentCaptured(container, data)
    case "order.canceled":
      return onOrderCanceled(container, data)
    default:
      return
  }
}

export const config: SubscriberConfig = {
  event: [
    "order.fulfillment_created",
    "shipment.created",
    "order.fulfillment_canceled",
    "payment.captured",
    "order.canceled",
  ],
}
