import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createOrderShipmentWorkflow,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { transitionMerchantOrderWorkflow } from "./transition-merchant-order"

/**
 * „Zásilku jsem předala dopravci" — phase two of the A1 dispatch invariant.
 *
 * When no carrier holds the parcel, `shipMerchantOrderWorkflow` stops after the
 * fulfilment: the goods are packed, inventory is decremented, and nothing has
 * left. This workflow is the merchant stating that it now has — and it is the
 * *only* thing besides an API-mode dispatch that may produce a shipment.
 *
 * That is the whole invariant: `shipped` — the stage, the native status and the
 * customer's e-mail — is only ever the consequence of a real
 * `createOrderShipmentWorkflow` run, never of a row existing somewhere.
 *
 * Idempotent by construction: with no open unshipped fulfilment there is
 * nothing to ship, so a second confirmation does nothing rather than creating a
 * second shipment.
 */

export type ConfirmMerchantHandoverInput = {
  order_id: string
  created_by?: string | null
  no_notification?: boolean
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export const confirmMerchantHandoverWorkflow = createWorkflow(
  "confirm-merchant-handover",
  (input: ConfirmMerchantHandoverInput) => {
    // The same lock the dispatch takes, so confirming while a ship is still
    // running cannot interleave into two shipments.
    const lockKey = transform(
      input,
      ({ order_id }) => `merchant-order:${order_id}`
    )
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })

    const orderQuery = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "items.id",
        "items.quantity",
        "items.requires_shipping",
        "items.detail.shipped_quantity",
        "fulfillments.id",
        "fulfillments.shipped_at",
        "fulfillments.canceled_at",
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "confirm-handover-get-order" })

    const plan = transform({ orderQuery }, ({ orderQuery }) => {
      const order = (orderQuery.data || [])[0] as any
      const items = (order?.items || []) as any[]

      const itemsToShip = items
        .filter((item) => item?.requires_shipping)
        .map((item) => ({
          id: item.id,
          quantity:
            toNumber(item.quantity) - toNumber(item.detail?.shipped_quantity),
        }))
        .filter((item) => item.quantity > 0)

      // The fulfilment that exists but has not left. If there is none, the
      // parcel either never got packed or has already gone.
      const openFulfillment = (order?.fulfillments || []).find(
        (fulfillment: any) =>
          !fulfillment?.canceled_at && !fulfillment?.shipped_at
      )

      return {
        fulfillment_id: openFulfillment?.id ?? null,
        items: itemsToShip,
        canConfirm: Boolean(openFulfillment?.id) && itemsToShip.length > 0,
      }
    })

    when(
      "create-shipment-on-handover",
      { plan },
      ({ plan }) => plan.canConfirm
    ).then(() => {
      createOrderShipmentWorkflow.runAsStep({
        input: {
          order_id: input.order_id,
          fulfillment_id: plan.fulfillment_id as string,
          items: plan.items,
          created_by: input.created_by ?? undefined,
          no_notification: input.no_notification,
        },
      })

      // The `shipment.created` reconciliation subscriber would move the stage
      // on its own, but doing it here as well makes the merchant's click feel
      // immediate rather than waiting on an event round-trip. Both paths are
      // idempotent, so running both is safe.
      transitionMerchantOrderWorkflow.runAsStep({
        input: {
          order_id: input.order_id,
          stage: "shipped",
          changed_by: input.created_by ?? null,
        },
      })
    })

    releaseLockStep({ key: lockKey })

    return new WorkflowResponse(plan)
  }
)
