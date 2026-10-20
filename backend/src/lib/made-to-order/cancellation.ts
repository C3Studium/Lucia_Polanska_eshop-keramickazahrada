import { round2, toNumber } from "../claims/refund-rules"

/**
 * Zrušení zakázky — co se vrací (LEGAL_AUDIT.md § 0, Z4–Z7). ČISTÉ rozhodnutí
 * bez kontejneru, dokazované testem (`lib/__tests__/made-to-order-cancellation`).
 * Orchestrace (žádost, refund, uzavření výroby, e-maily) je v
 * `customer-cancel.ts`, ať se pravidlo dá číst a ověřit samostatně.
 *
 * ## Pravidla
 *
 * - **Z7 — ruší prodávající** (`seller`): vrací se vše, bez ohledu na fázi
 *   (§ 1814 odst. 1 písm. c), e) OZ — symetrie).
 * - **Z4 — zákazník PŘED zahájením výroby**: vrací se vše. „Zahájení výroby"
 *   je objektivní, zaznamenaná událost: odeslaný e-mail „Zakázka je ve výrobě"
 *   (`production_start_notified_at`, Z3) — ne tvrzení kterékoli strany
 *   (§ 1814 odst. 1 písm. j)).
 * - **Z5 — zákazník PO zahájení výroby**: smluvní záloha (`deposit_amount`,
 *   ≤ 50 %) se nevrací, vše zaplacené nad ni ano; doplatek se nepožaduje.
 * - **Z6 — nezaplacený doplatek** 30 dnů po výzvě a připomenutí = Z5.
 *
 * Peníze přes `toNumber`/`round2` (BigNumber tvar z query.graph, haléře).
 */

export type CancelledBy = "customer" | "seller"

export type CancellationPhase = "before_production" | "after_production"

export type CancellationPlanInput = {
  /** Kdy odešel e-mail Z3; null = výroba ještě (prokazatelně) nezačala. */
  productionStartNotifiedAt: unknown
  /** Co zákazník za zakázku zaplatil a dosud nedostal zpět. */
  paidTotal: unknown
  /** Smluvní záloha v penězích (`contractDepositAmountOf`). */
  depositContract: unknown
  cancelledBy: CancelledBy
}

export type CancellationPlan = {
  phase: CancellationPhase
  /** Kolik se zákazníkovi vrací. */
  refund_amount: number
  /** Kolik ze zaplaceného zůstává prodávající (0 před zahájením a u Z7). */
  deposit_kept: number
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Fáze zrušení podle Z3: po odeslaném e-mailu o zahájení = `after_production`. */
export const cancellationPhaseOf = (
  productionStartNotifiedAt: unknown
): CancellationPhase =>
  toDate(productionStartNotifiedAt) ? "after_production" : "before_production"

export type CancellationEligibility = {
  can_cancel: boolean
  /** Česky pro zákazníka — proč to teď nejde; null, když jde. */
  blocked_reason: string | null
}

/**
 * Smí zákazník zakázku TEĎ zrušit? Ne u zrušené, hotové a zaplacené
 * (`ready_to_ship`) nebo dokončené zakázky a ne u zboží, které už odešlo —
 * tam je na řadě reklamace / převzetí, ne zrušení podle OP.
 */
export const cancellationEligibility = (input: {
  stage: string | null | undefined
  goodsShipped: boolean
}): CancellationEligibility => {
  const stage = String(input.stage ?? "")
  if (stage === "cancelled") {
    return { can_cancel: false, blocked_reason: "Zakázka je už zrušená." }
  }
  if (stage === "completed" || stage === "ready_to_ship") {
    return {
      can_cancel: false,
      blocked_reason:
        "Zakázka je hotová a zaplacená — zrušit ji už nejde. Má-li vadu, můžete ji reklamovat.",
    }
  }
  if (input.goodsShipped) {
    return {
      can_cancel: false,
      blocked_reason: "Zásilka už odešla — zakázku nejde zrušit. Má-li vadu, můžete ji reklamovat.",
    }
  }
  return { can_cancel: true, blocked_reason: null }
}

export const cancellationPlan = (input: CancellationPlanInput): CancellationPlan => {
  const phase = cancellationPhaseOf(input.productionStartNotifiedAt)
  const paid = Math.max(0, round2(toNumber(input.paidTotal)))
  const contract = Math.max(0, round2(toNumber(input.depositContract)))

  // Z7 a Z4: vrací se vše, co bylo zaplaceno.
  if (input.cancelledBy === "seller" || phase === "before_production") {
    return { phase, refund_amount: paid, deposit_kept: 0 }
  }

  // Z5: záloha zůstává (nejvýš to, co bylo zaplaceno), zbytek se vrací.
  const kept = round2(Math.min(paid, contract))
  return {
    phase,
    refund_amount: Math.max(0, round2(paid - contract)),
    deposit_kept: kept,
  }
}
