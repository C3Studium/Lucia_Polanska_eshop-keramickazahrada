/**
 * The shipping payment invariant (WorkflowPlan.md A2, §18, AC-3).
 *
 * ## Why this is arithmetic and not a status check
 *
 * `payment_status === "captured"` is a snapshot of a moment, and the
 * made-to-order flow deliberately invalidates it: confirming a specification
 * raises the order total through a native Order Edit *after* the deposit was
 * captured. The status still says „captured" while the customer now owes more.
 * The same happens after a partial refund. So the gate compares numbers:
 *
 * 1. captured − refunded ≥ the payable total, within the currency's rounding error
 * 2. the order's own `pending_difference` is not a real amount
 * 3. no order change is open (an edit in flight means the total is not settled)
 * 4. no payment collection is still waiting for money
 * 5. for a commission, nothing outstanding on the production order
 *
 * Any one of them failing blocks dispatch. `payment_status` is display only.
 *
 * ## Why it lives here
 *
 * The same rules are enforced in two places that cannot share a call stack: the
 * ship workflow (P3-4) and a middleware on the native fulfilment route (P4-4),
 * because `createOrderFulfillmentWorkflow` exposes only a post-hoc hook and can
 * therefore not be pre-validated any other way. Two copies of a money rule is
 * how a shop ends up shipping something it was not paid for, so there is one.
 *
 * Everything here is pure — no container, no queries — which is what makes the
 * matrix in the tests provable.
 */

import {
  defaultCurrencies,
  getEpsilonFromDecimalPrecision,
} from "@medusajs/framework/utils"

export type ShipGateCode =
  | "unpaid"
  | "pending_difference"
  | "order_change"
  | "open_collection"
  | "mto_outstanding"

export type ShipGateVerdict = {
  allowed: boolean
  code: ShipGateCode | null
  /** Czech, merchant-facing, safe to render on a card (§17: no technical terms). */
  reason: string | null
}

export type ShipGatePaymentCollection = {
  status?: string | null
  amount?: unknown
  captured_amount?: unknown
  refunded_amount?: unknown
  /** Rides along when the caller's fields include it — the dobírka exemption reads it. */
  payments?: Array<{ provider_id?: string | null }> | null
}

/** Cash on delivery: the carrier collects, so „zaplaceno" happens at the door. */
export const DOBIRKA_PROVIDER_ID = "pp_dobirka_ceska-posta"

export type ShipGateProductionOrder = {
  agreed_total?: unknown
  original_total?: unknown
  payment_requests?: Array<{ status?: string | null; amount?: unknown }> | null
}

export type ShipGateInput = {
  currency_code?: string | null
  total?: unknown
  /** Native order summary. Medusa models it as a list; the DTO flattens it. */
  summary?: { pending_difference?: unknown } | Array<{ pending_difference?: unknown }> | null
  payment_collections?: ShipGatePaymentCollection[] | null
  /** Order changes for this order, in any status — filtered here. */
  order_changes?: Array<{ status?: string | null }> | null
  production_order?: ShipGateProductionOrder | null
}

/** Statuses in which an order change is still in flight and the total unsettled. */
const OPEN_ORDER_CHANGE_STATUSES = ["pending", "requested"]

/** Collection statuses that mean the money question is closed, one way or another. */
const SETTLED_COLLECTION_STATUSES = ["completed", "canceled", "failed"]

export const toAmount = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  // BigNumber values arrive as `{ value, precision }` or `{ numeric_ }`.
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return toAmount(candidate.value ?? candidate.numeric_ ?? candidate.raw_ ?? 0)
  }
  return 0
}

/**
 * The largest difference that is still just rounding, for this currency.
 *
 * Uses Medusa's own `getEpsilonFromDecimalPrecision`, so CZK tolerates a haléř
 * and a zero-decimal currency like JPY tolerates nothing — rather than a
 * hardcoded 0.005 that is wrong for both.
 */
export const epsilonFor = (currencyCode?: string | null): number => {
  const code = String(currencyCode || "CZK").toUpperCase()
  const decimalDigits = (defaultCurrencies as Record<string, { decimal_digits?: number }>)[
    code
  ]?.decimal_digits

  return toAmount(getEpsilonFromDecimalPrecision(decimalDigits))
}

const formatMoney = (amount: number, currencyCode?: string | null): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: String(currencyCode || "CZK").toUpperCase(),
  }).format(amount)

const pendingDifferenceOf = (summary: ShipGateInput["summary"]): number => {
  if (!summary) {
    return 0
  }
  const record = Array.isArray(summary) ? summary[0] : summary
  return toAmount(record?.pending_difference)
}

/** What the customer still owes on a commission, from the module's own snapshots. */
export const productionOutstanding = (
  production: ShipGateProductionOrder | null | undefined
): number => {
  if (!production) {
    return 0
  }
  const total = toAmount(production.agreed_total ?? production.original_total)
  const paid = (production.payment_requests || [])
    .filter((request) => request?.status === "paid")
    .reduce((sum, request) => sum + toAmount(request.amount), 0)

  return total - paid
}

/**
 * Decides whether an order may be dispatched, and says why not in Czech.
 */
export const evaluateShipGate = (order: ShipGateInput): ShipGateVerdict => {
  const currency = order.currency_code
  const epsilon = epsilonFor(currency)

  // (3) An open order change means the total is still moving. Checked first
  // because every amount below would be measured against a number that is
  // about to change.
  const hasOpenChange = (order.order_changes || []).some((change) =>
    OPEN_ORDER_CHANGE_STATUSES.includes(String(change?.status ?? ""))
  )
  if (hasOpenChange) {
    return {
      allowed: false,
      code: "order_change",
      reason:
        "Na objednávce probíhá úprava. Nejdřív ji dokončete nebo zrušte, pak půjde odeslat.",
    }
  }

  // (1) The money that actually arrived and stayed.
  const collections = order.payment_collections || []

  /*
   * Dobírka never captures before dispatch — the whole point is that the
   * carrier collects at the door. Requiring `captured ≥ total` here made the
   * feature undispatchable: the only way to ship was to falsely capture
   * first. So a dobírka order skips the three card-money checks below; the
   * open-order-change check above and the commission balance below still
   * apply (a deposit is paid up front even when the rest is COD).
   */
  const isDobirka = collections.some((collection) =>
    (collection.payments || []).some(
      (payment) => payment?.provider_id === DOBIRKA_PROVIDER_ID
    )
  )
  if (isDobirka) {
    const outstandingDeposit = productionOutstanding(order.production_order)
    if (outstandingDeposit > epsilon) {
      return {
        allowed: false,
        code: "mto_outstanding",
        reason: `Zakázka není doplacená — chybí ${formatMoney(
          outstandingDeposit,
          currency
        )}. Odeslat ji půjde, jakmile peníze dorazí.`,
      }
    }
    return { allowed: true, code: null, reason: null }
  }

  const captured = collections.reduce(
    (sum, collection) => sum + toAmount(collection.captured_amount),
    0
  )
  const refunded = collections.reduce(
    (sum, collection) => sum + toAmount(collection.refunded_amount),
    0
  )
  const payable = toAmount(order.total)
  const shortfall = payable - (captured - refunded)

  if (shortfall > epsilon) {
    return {
      allowed: false,
      code: "unpaid",
      reason: `Objednávka není celá zaplacená — chybí ${formatMoney(
        shortfall,
        currency
      )}. Odeslat ji půjde, jakmile peníze dorazí.`,
    }
  }

  // (2) Medusa's own view of what is still owed, which catches cases the two
  // sums above cannot see on their own.
  const pendingDifference = pendingDifferenceOf(order.summary)
  if (pendingDifference > epsilon) {
    return {
      allowed: false,
      code: "pending_difference",
      reason: `U objednávky zbývá doplatit ${formatMoney(
        pendingDifference,
        currency
      )}.`,
    }
  }

  // (4) A collection still waiting for money means a payment link is open —
  // shipping now would be shipping mid-transaction.
  const openCollection = collections.find((collection) => {
    const status = String(collection?.status ?? "")
    if (SETTLED_COLLECTION_STATUSES.includes(status)) {
      return false
    }
    return toAmount(collection.amount) - toAmount(collection.captured_amount) > epsilon
  })
  if (openCollection) {
    return {
      allowed: false,
      code: "open_collection",
      reason:
        "U objednávky čeká nezaplacená platba. Odeslat ji půjde, jakmile bude zaplacená.",
    }
  }

  // (5) Commissions keep their own money record, because the deposit and the
  // balance are separate payments against an agreed price.
  const outstanding = productionOutstanding(order.production_order)
  if (outstanding > epsilon) {
    return {
      allowed: false,
      code: "mto_outstanding",
      reason: `Zakázka není doplacená — chybí ${formatMoney(
        outstanding,
        currency
      )}. Požádejte zákazníka o doplatek.`,
    }
  }

  return { allowed: true, code: null, reason: null }
}
