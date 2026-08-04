import { evaluateShipGate } from "../../../lib/ship-gate"
import { paymentProblemReason } from "../../../modules/merchant-order/payment-state"
import type { MerchantOrderStage } from "../../../modules/merchant-order/stages"

/**
 * Flat, merchant-facing row.
 *
 * The admin list renders this verbatim. Nothing here is recomputed in the browser —
 * every money and status value is the one Medusa produced, so the queue and the native
 * order page can never disagree.
 */
export type MerchantOrderRow = {
  id?: string
  order_id: string
  stage: MerchantOrderStage
  requires_attention: boolean
  attention_reason: string | null
  internal_note: string | null
  stage_changed_at: Date | string | null

  display_id: number | string | null
  /** Order creation date — not the date the merchant state row was written. */
  created_at: Date | string | null
  email: string | null
  customer_name: string | null
  currency_code: string
  total: number | string | null
  item_count: number
  shipping_method: string | null

  /** Native, workflow-computed. Never derived here. */
  payment_status: string | null
  fulfillment_status: string | null
  has_fulfillment: boolean

  is_made_to_order: boolean
  production_stage: string | null

  /**
   * True when the parcel is packed but nobody has handed it over yet — the
   * derived A1 state (§5.4). No new column: `stage = shipping` plus a
   * fulfilment that exists and has not shipped is the whole definition.
   */
  awaiting_handover: boolean

  /** Collected in person at the workshop — money and goods meet at the counter. */
  is_personal_pickup: boolean

  /**
   * Why dispatch is blocked, in Czech, or `null` when it is not (A2).
   * Computed server-side by the same rules the ship workflow enforces, so the
   * card can never offer a button the backend would refuse.
   */
  ship_block_reason: string | null
}

const customerName = (order: any): string | null => {
  const candidates = [
    [order?.customer?.first_name, order?.customer?.last_name],
    [order?.shipping_address?.first_name, order?.shipping_address?.last_name],
  ]
  for (const [first, last] of candidates) {
    const name = [first, last].filter(Boolean).join(" ").trim()
    if (name) {
      return name
    }
  }
  return null
}

const itemCount = (order: any): number =>
  (order?.items || []).reduce(
    (sum: number, item: any) => sum + Number(item?.quantity || 0),
    0
  )

const shippingMethod = (order: any): string | null => {
  const method = (order?.shipping_methods || [])[0]
  return method?.name || method?.title || null
}

export const toMerchantOrderRow = (
  state: any,
  order: any | null,
  productionOrder: any | null,
  orderChanges: any[] = []
): MerchantOrderRow => {
  // Medusa's payment status is authoritative. A stored flag can go stale (a payment that
  // succeeded after the order was flagged), so the derived signal wins and the stored one
  // only adds detail.
  const derivedReason = paymentProblemReason(order?.payment_status)

  // The same verdict the ship workflow will reach, so the UI hides the action
  // for exactly the orders the backend would reject — never one more, never one
  // fewer. Only meaningful for orders that are still on their way out.
  const gate =
    order && !["shipped", "cancelled"].includes(state.stage)
      ? evaluateShipGate({
          currency_code: order.currency_code,
          total: order.total,
          summary: order.summary,
          payment_collections: order.payment_collections || [],
          order_changes: orderChanges,
          production_order: productionOrder,
        })
      : { allowed: true, reason: null }

  return {
    id: state.id,
    order_id: state.order_id,
    stage: state.stage,
    requires_attention: Boolean(derivedReason),
    attention_reason: derivedReason ?? state.attention_reason ?? null,
    internal_note: state.internal_note ?? null,
    stage_changed_at: state.stage_changed_at ?? null,

    display_id: order?.display_id ?? null,
    created_at: order?.created_at ?? null,
    email: order?.email ?? null,
    customer_name: customerName(order),
    currency_code: String(order?.currency_code || "czk"),
    total: order?.total ?? null,
    item_count: itemCount(order),
    shipping_method: shippingMethod(order),

    payment_status: order?.payment_status ?? null,
    fulfillment_status: order?.fulfillment_status ?? null,
    has_fulfillment: Boolean(
      (order?.fulfillments || []).some((f: any) => !f?.canceled_at)
    ),

    is_personal_pickup: (order?.shipping_methods || []).some((method: any) => {
      const methodData = method?.data || {}
      return (
        methodData.personal_pickup === true || methodData.service_code === "PICKUP"
      )
    }),

    awaiting_handover:
      state.stage === "shipping" &&
      (order?.fulfillments || []).some(
        (f: any) => !f?.canceled_at && !f?.shipped_at
      ),

    is_made_to_order: Boolean(productionOrder),
    production_stage: productionOrder?.stage ?? null,

    ship_block_reason: gate.allowed ? null : gate.reason,
  }
}
