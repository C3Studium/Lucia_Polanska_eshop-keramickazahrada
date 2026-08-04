import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  capturePaymentWorkflow,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { transitionMerchantOrderWorkflow } from "./transition-merchant-order"

/**
 * „Vyzvednuto a zaplaceno" — the customer collected the piece and paid at the
 * counter.
 *
 * ## Why personal collection needs its own action
 *
 * Every other order leaves through the dispatch flow, which is gated on the
 * money having already arrived (A2). Personal collection inverts that: the
 * money arrives *at the same moment* the goods leave, in cash, in her hand.
 * Running the ordinary flow would be impossible — the gate would refuse an
 * order that is about to be paid, correctly, forever.
 *
 * So this is one action that records both facts in the order they happen:
 *
 * 1. **capture the payment** — the customer has paid; until this the order
 *    holds only an authorization, a promise;
 * 2. **fulfil** — the goods leave stock;
 * 3. **ship** — Medusa's way of saying they are gone, which for a collection is
 *    true the instant she hands the bag over.
 *
 * Capture comes first deliberately. If it fails there is nothing to undo: the
 * piece is still on the shelf and the order is untouched. Doing it last would
 * mean handing over goods and *then* discovering the record could not be
 * written.
 *
 * ## It refuses to be used on anything else
 *
 * The validation step rejects orders that are not personal collection. Cash at
 * the counter is the one exception to „no money, no goods" (D1), and an
 * exception that can be applied to any order is not an exception — it is a
 * hole.
 */

export type CompletePersonalPickupInput = {
  order_id: string
  created_by?: string | null
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Confirms this really is a personal collection, and that there is money to
 * take. Exported for the unit tests, which is where the exception's boundary is
 * actually pinned down.
 */
export const assertPersonalPickup = (order: any): {
  paymentId: string | null
  amountDue: number
} => {
  const isPickup = (order?.shipping_methods || []).some((method: any) => {
    const data = method?.data || {}
    return (
      data.personal_pickup === true ||
      data.service_code === "PICKUP" ||
      String(method?.shipping_option?.provider_id ?? "").includes("pickup")
    )
  })

  if (!isPickup) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Tuto akci lze použít jen u objednávek s osobním odběrem."
    )
  }

  const collections = order?.payment_collections || []
  const payments = collections.flatMap(
    (collection: any) => collection?.payments || []
  )

  // The authorization created at checkout. Already-captured means she has
  // recorded the money before — nothing left to take.
  const outstanding = payments.find(
    (payment: any) => !payment?.captured_at && !payment?.canceled_at
  )

  const amountDue = collections.reduce(
    (sum: number, collection: any) =>
      sum + (toNumber(collection.amount) - toNumber(collection.captured_amount)),
    0
  )

  return { paymentId: outstanding?.id ?? null, amountDue }
}

const validatePickupStep = createStep(
  "validate-personal-pickup",
  async (order: any) => new StepResponse(assertPersonalPickup(order))
)

export const completePersonalPickupWorkflow = createWorkflow(
  "complete-personal-pickup",
  (input: CompletePersonalPickupInput) => {
    const lockKey = transform(
      input,
      ({ order_id }) => `merchant-order:${order_id}`
    )
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })

    const orderQuery = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "items.*",
        "items.detail.fulfilled_quantity",
        "items.detail.shipped_quantity",
        "shipping_methods.*",
        "shipping_methods.shipping_option.provider_id",
        "payment_collections.amount",
        "payment_collections.captured_amount",
        "payment_collections.payments.id",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
        "fulfillments.id",
        "fulfillments.shipped_at",
        "fulfillments.canceled_at",
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "personal-pickup-get-order" })

    const order = transform(
      { orderQuery },
      ({ orderQuery }) => (orderQuery.data || [])[0] as any
    )

    const check = validatePickupStep(order)

    // 1 — the money, first, because a failure here costs nothing.
    when(
      "capture-pickup-payment",
      { check },
      ({ check }) => Boolean(check.paymentId) && check.amountDue > 0.005
    ).then(() => {
      capturePaymentWorkflow.runAsStep({
        input: {
          payment_id: check.paymentId as string,
          captured_by: input.created_by ?? undefined,
        },
      })
    })

    const plan = transform({ order }, ({ order }) => {
      const items = (order?.items || []) as any[]
      const shippable = items.filter((item) => item?.requires_shipping)

      const toFulfill = shippable
        .map((item) => ({
          id: item.id,
          quantity:
            toNumber(item.quantity) - toNumber(item.detail?.fulfilled_quantity),
        }))
        .filter((item) => item.quantity > 0)

      const toShip = shippable
        .map((item) => ({
          id: item.id,
          quantity:
            toNumber(item.quantity) - toNumber(item.detail?.shipped_quantity),
        }))
        .filter((item) => item.quantity > 0)

      const openFulfillment = (order?.fulfillments || []).find(
        (fulfillment: any) =>
          !fulfillment?.canceled_at && !fulfillment?.shipped_at
      )

      return {
        toFulfill,
        toShip,
        existingFulfillmentId: openFulfillment?.id ?? null,
        needsFulfillment: toFulfill.length > 0,
      }
    })

    // 2 — the goods leave stock.
    const created = when(
      "fulfil-on-pickup",
      { plan },
      ({ plan }) => plan.needsFulfillment
    ).then(() =>
      createOrderFulfillmentWorkflow.runAsStep({
        input: {
          order_id: input.order_id,
          items: plan.toFulfill,
          created_by: input.created_by ?? undefined,
        },
      })
    )

    // 3 — and they are gone, which for a collection is true immediately.
    const shipment = transform({ created, plan }, ({ created, plan }) => ({
      fulfillment_id: (created as any)?.id ?? plan.existingFulfillmentId,
      items: plan.toShip,
    }))

    when(
      "ship-on-pickup",
      { shipment, plan },
      ({ shipment, plan }) =>
        !!shipment.fulfillment_id && plan.toShip.length > 0
    ).then(() => {
      createOrderShipmentWorkflow.runAsStep({
        input: {
          order_id: input.order_id,
          fulfillment_id: shipment.fulfillment_id as string,
          items: shipment.items,
          created_by: input.created_by ?? undefined,
        },
      })

      transitionMerchantOrderWorkflow.runAsStep({
        input: {
          order_id: input.order_id,
          stage: "shipped",
          changed_by: input.created_by ?? null,
        },
      })
    })

    releaseLockStep({ key: lockKey })

    return new WorkflowResponse(check)
  }
)
