import { isDamageCause } from "../../../lib/claims/constants"
import { suggestedRefundAmount } from "../../../lib/claims/line-items"
import {
  moneyState,
  requestRefundedTotal,
} from "../../../lib/claims/refund-rules"
import {
  DOBIRKA_PROVIDER_ID,
  evaluateShipGate,
  productionOutstanding,
} from "../../../lib/ship-gate"
import { paymentProblemReason } from "../../../modules/merchant-order/payment-state"
import type { MerchantOrderStage } from "../../../modules/merchant-order/stages"

/**
 * Poslední žádost modulu „Reklamace a zrušení" k objednávce
 * (docs/reklamace-a-zruseni.md §11.4) — pro záložky Zrušené · Vrácení peněz ·
 * Reklamace v Objednávky+ a odkaz „Otevřít v Reklamace a zrušení".
 */
export type MerchantOrderClaim = {
  id: string
  kind: string | null
  status: string | null
  reason: string | null
  /** „carrier" = poškozeno přepravou (badge). */
  damage_cause: string | null
  /** Vráceno přes TUTO žádost (součet jejích refundací). */
  refund_amount: number
  /** Zachyceno − vráceno na celé objednávce (všechny žádosti + refund_history). */
  remaining: number
  /** Výchozí částka refundace (§11.2): cena vybraných položek, bez položek zbývá. */
  suggested_amount: number
  created_at: Date | string | null
}

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
  /**
   * Kolik už reálně došlo — součet `captured_amount` přes platební kolekce.
   * U zakázky placené zálohou je to záloha (ne `total`), dokud se nedoplatí;
   * fronta tak může ukázat „zaplaceno X, zbývá Y" místo plné částky.
   */
  paid_total: number | null
  item_count: number
  shipping_method: string | null

  /** Native, workflow-computed. Never derived here. */
  payment_status: string | null
  fulfillment_status: string | null
  has_fulfillment: boolean

  is_made_to_order: boolean
  production_stage: string | null
  /**
   * Co zákazník na zakázce ještě dluží (včetně příplatku), zaokrouhleno; null
   * u běžné objednávky. Fronta tím u osobního odběru napoví, že „Vyzvednuto a
   * zaplaceno" zámek odmítne, dokud se doplatek nezapíše „Zaplaceno na místě".
   */
  production_outstanding: number | null

  /**
   * True when the parcel is packed but nobody has handed it over yet — the
   * derived A1 state (§5.4). No new column: `stage = shipping` plus a
   * fulfilment that exists and has not shipped is the whole definition.
   */
  awaiting_handover: boolean

  /** Collected in person at the workshop — money and goods meet at the counter. */
  is_personal_pickup: boolean

  /**
   * Dobírka whose parcel already left, waiting for Česká pošta to settle the
   * collected money — drives the „Peníze přišly (dobírka)" button. Derived:
   * a dobírka payment with no capture, on an order in the shipped stage.
   */
  dobirka_waiting: boolean

  /**
   * Why dispatch is blocked, in Czech, or `null` when it is not (A2).
   * Computed server-side by the same rules the ship workflow enforces, so the
   * card can never offer a button the backend would refuse.
   */
  ship_block_reason: string | null

  /**
   * Money owed BACK to the customer — written when a customer edit lowered the
   * total or a paid commission was cancelled, cleared by „Vrátit rozdíl".
   * Lives on the order's metadata under `refund_due`.
   */
  refund_due: { amount: number; currency_code: string; reason?: string } | null

  /**
   * Poslední žádost (reklamace / vrácení / odstoupení) k objednávce, nebo
   * null (§11.4). Vyplní se jen tam, kde volající žádosti načetl (seznam
   * Objednávky+); detail a souhrn operací je zatím neposílají → null.
   */
  claim: MerchantOrderClaim | null

  /**
   * Proč je objednávka zrušená (jen fáze `cancelled`): důvod z žádosti o
   * odstoupení / vrácení, jinak poznámka u přechodu do `cancelled` v historii
   * fází. Null mimo fázi cancelled nebo bez důvodu.
   */
  cancel_reason: string | null
}

const timeOf = (value: unknown): number => {
  if (!value) return 0
  const time = new Date(value as string).getTime()
  return Number.isFinite(time) ? time : 0
}

/** Nejnovější žádost podle `created_at` (bez data = nejstarší). */
export const latestRequestOf = (requests: any[] | null | undefined): any | null => {
  if (!requests?.length) return null
  return [...requests].sort(
    (a, b) => timeOf(b?.created_at) - timeOf(a?.created_at)
  )[0]
}

/**
 * `claim` pro řádek: poslední žádost + peníze přes celou objednávku
 * (`moneyState` počítá se VŠEMI žádostmi, aby „zbývá" sedělo s modulem).
 * `order` null (objednávka nenačtená) → zachyceno 0, zbývá 0.
 */
export const claimSummaryFor = (
  order: any | null,
  requests: any[] | null | undefined
): MerchantOrderClaim | null => {
  const latest = latestRequestOf(requests)
  if (!latest) return null
  const state = moneyState(order ?? {}, requests ?? [])
  return {
    id: latest.id,
    kind: latest.kind ?? null,
    status: latest.status ?? null,
    reason: typeof latest.reason === "string" ? latest.reason : null,
    damage_cause: isDamageCause(latest.damage_cause) ? latest.damage_cause : null,
    refund_amount: requestRefundedTotal(latest),
    remaining: state.remaining,
    suggested_amount: suggestedRefundAmount(state.remaining, latest.line_items),
    created_at: latest.created_at ?? null,
  }
}

/**
 * Důvod zrušení (§11.4): žádost o odstoupení / vrácení má přednost (to je
 * zákazníkův důvod), jinak poznámka z posledního přechodu do `cancelled`.
 */
export const cancelReasonFor = (
  state: any,
  requests: any[] | null | undefined
): string | null => {
  if (state?.stage !== "cancelled") return null
  const withdrawal = latestRequestOf(
    (requests ?? []).filter(
      (request) => request?.kind === "odstoupeni" || request?.kind === "vraceni"
    )
  )
  if (withdrawal && typeof withdrawal.reason === "string" && withdrawal.reason.trim()) {
    return withdrawal.reason.trim()
  }
  const history: any[] = Array.isArray(state?.stage_history) ? state.stage_history : []
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]
    if (entry?.to === "cancelled" && typeof entry?.note === "string" && entry.note.trim()) {
      return entry.note.trim()
    }
  }
  return null
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
  orderChanges: any[] = [],
  /** Žádosti modulu reklamací k TÉTO objednávce (§11.4); undefined = nenačteno → `claim: null`. */
  returnRequests?: any[]
): MerchantOrderRow => {
  // Medusa's payment status is authoritative. A stored flag can go stale (a payment that
  // succeeded after the order was flagged), so the derived signal wins and the stored one
  // only adds detail.
  const derivedReason = paymentProblemReason(order?.payment_status)

  // Reálně zachycené peníze napříč kolekcemi. `captured_amount` je ve stejných
  // (hlavních) jednotkách jako `order.total`, takže se dají rovnou porovnat.
  const capturedTotal = (order?.payment_collections || []).reduce(
    (sum: number, collection: any) =>
      sum + Number(collection?.captured_amount || 0),
    0
  )

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
    paid_total: order ? capturedTotal : null,
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

    // Only once the parcel is gone: before that the carrier holds nothing,
    // so there is no money that could have arrived.
    dobirka_waiting:
      state.stage === "shipped" &&
      (order?.payment_collections || [])
        .flatMap((collection: any) => collection?.payments || [])
        .some(
          (payment: any) =>
            payment?.provider_id === DOBIRKA_PROVIDER_ID &&
            !payment?.captured_at &&
            !payment?.canceled_at
        ),

    awaiting_handover:
      state.stage === "shipping" &&
      (order?.fulfillments || []).some(
        (f: any) => !f?.canceled_at && !f?.shipped_at
      ),

    is_made_to_order: Boolean(productionOrder),
    production_stage: productionOrder?.stage ?? null,
    production_outstanding: productionOrder
      ? Math.round(Math.max(0, productionOutstanding(productionOrder)) * 100) / 100
      : null,

    ship_block_reason: gate.allowed ? null : gate.reason,

    refund_due:
      order?.metadata?.refund_due &&
      typeof order.metadata.refund_due === "object" &&
      Number(order.metadata.refund_due.amount) > 0
        ? {
            amount: Number(order.metadata.refund_due.amount),
            currency_code: String(
              order.metadata.refund_due.currency_code || order?.currency_code || "czk"
            ),
            reason: order.metadata.refund_due.reason,
          }
        : null,

    claim: returnRequests ? claimSummaryFor(order, returnRequests) : null,
    cancel_reason: cancelReasonFor(state, returnRequests),
  }
}
