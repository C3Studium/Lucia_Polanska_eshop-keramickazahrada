import type { MerchantOrderStage } from "./stages"

/**
 * Maps Medusa's native payment status onto the merchant queue.
 *
 * The merchant never flags a payment problem by hand. Medusa already knows — it computes
 * `payment_status` from the order's payment collections in `getLastPaymentStatus()` — so
 * the queue derives the flag from that single source instead of keeping a second,
 * hand-maintained truth that drifts.
 *
 * `partially_captured` is deliberately **not** a problem: a made-to-order order with a
 * paid deposit and an outstanding balance is in exactly that state by design, and it
 * would otherwise fill the problem queue with healthy orders. The same applies to
 * `authorized` — the money is secured even though it has not been drawn yet.
 */
export const PAYMENT_PROBLEM_STATUSES = [
  "not_paid",
  "awaiting",
  "requires_action",
  "canceled",
] as const

export type PaymentProblemStatus = (typeof PAYMENT_PROBLEM_STATUSES)[number]

const PAYMENT_PROBLEM_REASONS: Record<PaymentProblemStatus, string> = {
  not_paid: "Platba zatím nedorazila.",
  awaiting: "Čekáme na potvrzení platby.",
  requires_action: "Platba vyžaduje zásah.",
  canceled: "Platba byla zrušena.",
}

export const isPaymentProblem = (
  paymentStatus: string | null | undefined
): paymentStatus is PaymentProblemStatus =>
  !!paymentStatus &&
  PAYMENT_PROBLEM_STATUSES.includes(paymentStatus as PaymentProblemStatus)

export const paymentProblemReason = (
  paymentStatus: string | null | undefined
): string | null =>
  isPaymentProblem(paymentStatus)
    ? PAYMENT_PROBLEM_REASONS[paymentStatus]
    : null

/**
 * The stage a freshly placed order belongs in. An order whose payment never landed goes
 * straight to the problem queue rather than into "Nové", where it would look ready to
 * pack.
 */
export const initialStageForPayment = (
  paymentStatus: string | null | undefined
): MerchantOrderStage => (isPaymentProblem(paymentStatus) ? "payment_problem" : "received")
