import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { transitionMerchantOrderWorkflow } from "./transition-merchant-order"

/**
 * Turns the merchant's single "Označit jako odeslané" click into the complete native
 * fulfilment flow.
 *
 * ## Why this workflow exists (and what it deliberately does not do)
 *
 * Medusa already owns every part of this: `createOrderFulfillmentWorkflow` reserves and
 * decrements inventory, resolves the stock location from the order's shipping option and
 * links the fulfilment to the order; `createOrderShipmentWorkflow` registers the shipment
 * and moves the order to `shipped`. What Medusa does *not* provide is a single entry point
 * that runs both and then records that the merchant is done with the order.
 *
 * So this workflow is purely an **orchestrator**. It contains no fulfilment logic, no
 * inventory maths and no direct database writes beyond `merchant_order_state`. Everything
 * else is `runAsStep` into the native workflows, which means compensation, event emission
 * and inventory handling stay Medusa's responsibility and survive upgrades.
 *
 * The merchant stage is moved **last and only on success** — if fulfilment fails, the
 * order stays in "K odeslání" rather than silently claiming to be shipped.
 */

export type ShipMerchantOrderInput = {
  order_id: string
  created_by?: string | null
  no_notification?: boolean
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export const shipMerchantOrderWorkflow = createWorkflow(
  "ship-merchant-order",
  (input: ShipMerchantOrderInput) => {
    const orderQuery = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "status",
        "items.id",
        "items.quantity",
        "items.requires_shipping",
        "items.detail.fulfilled_quantity",
        "items.detail.shipped_quantity",
        "fulfillments.id",
        "fulfillments.shipped_at",
        "fulfillments.canceled_at",
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "ship-merchant-order-get-order" })

    const plan = transform({ orderQuery }, ({ orderQuery }) => {
      const order = (orderQuery.data || [])[0] as any

      const items = (order?.items || []) as any[]

      // Only physical items participate in fulfilment. Medusa's validation rejects a
      // mixed batch, so digital/no-shipping lines are excluded rather than filtered later.
      const shippableItems = items.filter((item) => item?.requires_shipping)

      const itemsToFulfill = shippableItems
        .map((item) => ({
          id: item.id,
          quantity:
            toNumber(item.quantity) -
            toNumber(item.detail?.fulfilled_quantity),
        }))
        .filter((item) => item.quantity > 0)

      const itemsToShip = shippableItems
        .map((item) => ({
          id: item.id,
          quantity:
            toNumber(item.quantity) - toNumber(item.detail?.shipped_quantity),
        }))
        .filter((item) => item.quantity > 0)

      // A fulfilment created earlier on the native order page is reused instead of
      // creating a second one for the same goods.
      const openFulfillment = (order?.fulfillments || []).find(
        (fulfillment: any) =>
          !fulfillment?.canceled_at && !fulfillment?.shipped_at
      )

      return {
        itemsToFulfill,
        itemsToShip,
        existingFulfillmentId: openFulfillment?.id ?? null,
        needsFulfillment: itemsToFulfill.length > 0,
        needsShipment: itemsToShip.length > 0,
      }
    })

    const createdFulfillment = when(
      "create-fulfillment-when-outstanding",
      { plan },
      ({ plan }) => plan.needsFulfillment
    ).then(() => {
      return createOrderFulfillmentWorkflow.runAsStep({
        input: {
          order_id: input.order_id,
          items: plan.itemsToFulfill,
          created_by: input.created_by ?? undefined,
          no_notification: input.no_notification,
        },
      })
    })

    const shipment = transform(
      { createdFulfillment, plan, input },
      ({ createdFulfillment, plan, input }) => ({
        order_id: input.order_id,
        fulfillment_id:
          (createdFulfillment as any)?.id ?? plan.existingFulfillmentId,
        items: plan.itemsToShip,
        created_by: input.created_by ?? undefined,
        no_notification: input.no_notification,
      })
    )

    when(
      "create-shipment-when-fulfilled",
      { shipment, plan },
      ({ shipment, plan }) => plan.needsShipment && !!shipment.fulfillment_id
    ).then(() => {
      createOrderShipmentWorkflow.runAsStep({
        input: {
          order_id: shipment.order_id,
          fulfillment_id: shipment.fulfillment_id as string,
          items: shipment.items,
          created_by: shipment.created_by,
          no_notification: shipment.no_notification,
        },
      })
    })

    // Recorded last: the queue only claims the order is shipped once Medusa agrees.
    const state = transitionMerchantOrderWorkflow.runAsStep({
      input: {
        order_id: input.order_id,
        stage: "shipped",
        changed_by: input.created_by ?? null,
      },
    })

    return new WorkflowResponse(state)
  }
)
