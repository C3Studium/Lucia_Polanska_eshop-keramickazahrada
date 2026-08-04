import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { assertShipGateStep } from "./steps/assert-ship-gate"
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
    // The same lock the stage transition takes. Held for the whole run so a
    // double click cannot start two fulfilment chains for one order — the
    // second caller waits, then finds the goods already fulfilled and shipped.
    const lockKey = transform(
      input,
      ({ order_id }) => `merchant-order:${order_id}`
    )
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })

    const orderQuery = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "status",
        "currency_code",
        // `total` is derived from the item projection; `summary` and the
        // payment collections are what the A2 gate does its arithmetic on.
        "total",
        "items.*",
        "items.detail.fulfilled_quantity",
        "items.detail.shipped_quantity",
        "summary.*",
        "payment_collections.status",
        "payment_collections.amount",
        "payment_collections.captured_amount",
        "payment_collections.refunded_amount",
        "fulfillments.id",
        "fulfillments.shipped_at",
        "fulfillments.canceled_at",
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "ship-merchant-order-get-order" })

    // Read-only module links are uni-directional: a production order can only be
    // reached *from* `production_order`, never from the order.
    const productionQuery = useQueryGraphStep({
      entity: "production_order",
      fields: [
        "id",
        "order_id",
        "agreed_total",
        "original_total",
        "payment_requests.status",
        "payment_requests.amount",
      ],
      filters: { order_id: input.order_id },
    }).config({ name: "ship-merchant-order-get-production" })

    // Order changes are their own entity — an edit in flight means the total is
    // not settled yet, whatever `payment_status` currently claims.
    const orderChangeQuery = useQueryGraphStep({
      entity: "order_change",
      fields: ["id", "status"],
      filters: { order_id: input.order_id },
    }).config({ name: "ship-merchant-order-get-order-changes" })

    const gateInput = transform(
      { orderQuery, productionQuery, orderChangeQuery },
      ({ orderQuery, productionQuery, orderChangeQuery }) => {
        const order = (orderQuery.data || [])[0] as any
        return {
          currency_code: order?.currency_code,
          total: order?.total,
          summary: order?.summary,
          payment_collections: order?.payment_collections || [],
          order_changes: (orderChangeQuery.data || []) as any[],
          production_order: ((productionQuery.data || [])[0] as any) ?? null,
        }
      }
    )

    // Before anything native is touched, so a blocked order has nothing to
    // compensate: no fulfilment, no inventory movement, no stage change.
    assertShipGateStep(gateInput)

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
      ({ createdFulfillment, plan, input }) => {
        const fulfillment = createdFulfillment as any

        // A1 — the dispatch invariant.
        //
        // A fulfilment with no carrier-side record means the goods are packed
        // and nothing more. Creating a shipment here would tell the customer
        // „odesláno" and set the native status to shipped on the strength of a
        // database row, when in reality the parcel is still on her table.
        //
        // So record-only mode stops after the fulfilment. The order stays in
        // K odeslání showing „Čeká na ruční podání zásilky.", and only her
        // explicit „Zásilku jsem předala dopravci" — which runs
        // `confirmMerchantHandoverWorkflow` — produces a real shipment.
        const mode = fulfillment?.data?.mode
        const carrierHasParcel = mode === "api"

        return {
          order_id: input.order_id,
          fulfillment_id: fulfillment?.id ?? plan.existingFulfillmentId,
          items: plan.itemsToShip,
          created_by: input.created_by ?? undefined,
          no_notification: input.no_notification,
          // A pre-existing fulfilment (created on the native page) has no mode
          // of ours to read, so it is treated as record-only too — the safe
          // direction.
          carrier_has_parcel: carrierHasParcel,
        }
      }
    )

    when(
      "create-shipment-when-fulfilled",
      { shipment, plan },
      ({ shipment, plan }) =>
        plan.needsShipment &&
        !!shipment.fulfillment_id &&
        shipment.carrier_has_parcel
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

    // Recorded last, and only when a shipment actually happened. In
    // record-only mode the stage stays `shipping` — the order is packed, not
    // gone — and the card switches its action to „Zásilku jsem předala
    // dopravci".
    when(
      "advance-stage-when-shipped",
      { shipment, plan },
      ({ shipment, plan }) =>
        shipment.carrier_has_parcel && (plan.needsShipment || plan.needsFulfillment)
    ).then(() => {
      transitionMerchantOrderWorkflow.runAsStep({
        input: {
          order_id: input.order_id,
          stage: "shipped",
          changed_by: input.created_by ?? null,
        },
      })
    })

    releaseLockStep({ key: lockKey })

    return new WorkflowResponse(shipment)
  }
)
