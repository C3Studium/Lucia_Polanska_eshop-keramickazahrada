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
  productionOrder: any | null
): MerchantOrderRow => {
  // Medusa's payment status is authoritative. A stored flag can go stale (a payment that
  // succeeded after the order was flagged), so the derived signal wins and the stored one
  // only adds detail.
  const derivedReason = paymentProblemReason(order?.payment_status)

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

    is_made_to_order: Boolean(productionOrder),
    production_stage: productionOrder?.stage ?? null,
  }
}
