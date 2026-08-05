import type { MerchantOrderStage } from "../../../../../modules/merchant-order/stages"

export type CustomerOrderProgress = {
  /** Raw merchant stage, or `null` when the order has no merchant record. */
  stage: MerchantOrderStage | null
  /** Czech, customer-facing. `null` when `stage` is. */
  stage_label: string | null
  stage_changed_at: string | Date | null
  made_to_order: boolean
  /** „Slíbeno do" — the completion date she committed to, when set. */
  promised_at: string | Date | null
  /** Diary entries she explicitly shared — the making, newest first. */
  making: { text: string | null; image_url: string | null; at: string }[]
  balance: {
    outstanding: number
    currency_code: string
    payment_url: string | null
  } | null
}

/**
 * The merchant's stages, said to the customer.
 *
 * These are **not** the same words. `MERCHANT_ORDER_STAGES` answers „what do I
 * do with this next?" and is written for the person doing the work: `working`,
 * `shipping`, `payment_problem`. Handing those to a customer would be
 * translating an internal queue into a status page.
 *
 * Two are worth their specific wording:
 *
 * - `shipping` means *packed, waiting for the carrier* — not *in transit*.
 *   „Odesíláme" would read as already gone and produce a tracking question a
 *   day early.
 * - `payment_problem` says „Čeká na platbu", which is the customer's half of
 *   that state and something they can act on. „Problém s platbou" describes our
 *   trouble and invites a worried e-mail about money that may already be fine.
 *
 * A `null` stage is not an error: orders placed before the merchant-order
 * module existed, and any order it has not picked up yet, simply have none. The
 * storefront falls back to Medusa's own status there.
 */
const CUSTOMER_STAGE_LABELS: Record<MerchantOrderStage, string> = {
  received: "Přijato",
  working: "Připravujeme",
  shipping: "Chystáme k odeslání",
  shipped: "Odesláno",
  payment_problem: "Čeká na platbu",
  cancelled: "Zrušeno",
}

export const customerStageLabel = (
  stage: MerchantOrderStage | string | null | undefined
): string | null =>
  stage && stage in CUSTOMER_STAGE_LABELS
    ? CUSTOMER_STAGE_LABELS[stage as MerchantOrderStage]
    : null
