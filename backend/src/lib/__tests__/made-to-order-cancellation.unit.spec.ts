import {
  cancellationEligibility,
  cancellationPhaseOf,
  cancellationPlan,
} from "../made-to-order/cancellation"

/**
 * LEGAL_AUDIT.md § 0, Z4–Z7: co se při zrušení zakázky vrací. Čisté pravidlo
 * (`lib/made-to-order/cancellation`) — bez kontejneru.
 */

const NOTIFIED = "2026-10-20T12:32:00.000Z"

describe("cancellationPlan — Z4/Z5/Z7", () => {
  it("Z4: zákazník PŘED e-mailem o zahájení → vrací se vše", () => {
    expect(
      cancellationPlan({
        productionStartNotifiedAt: null,
        paidTotal: 1250,
        depositContract: 1250,
        cancelledBy: "customer",
      })
    ).toEqual({ phase: "before_production", refund_amount: 1250, deposit_kept: 0 })
  })

  it("Z5: zaplaceno 100 %, po zahájení → vrací se 100 − záloha", () => {
    expect(
      cancellationPlan({
        productionStartNotifiedAt: NOTIFIED,
        paidTotal: 5000,
        depositContract: 1250,
        cancelledBy: "customer",
      })
    ).toEqual({ phase: "after_production", refund_amount: 3750, deposit_kept: 1250 })
  })

  it("Z5: zaplacena jen záloha, po zahájení → nic se nevrací", () => {
    expect(
      cancellationPlan({
        productionStartNotifiedAt: NOTIFIED,
        paidTotal: 1250,
        depositContract: 1250,
        cancelledBy: "customer",
      })
    ).toEqual({ phase: "after_production", refund_amount: 0, deposit_kept: 1250 })
  })

  it("Z5: zaplaceno míň než smluvní záloha (sleva) → ponechá se jen zaplacené, nikdy záporný refund", () => {
    expect(
      cancellationPlan({
        productionStartNotifiedAt: NOTIFIED,
        paidTotal: 900,
        depositContract: 1250,
        cancelledBy: "customer",
      })
    ).toEqual({ phase: "after_production", refund_amount: 0, deposit_kept: 900 })
  })

  it("Z7: ruší prodávající → vrací se vše i po zahájení", () => {
    expect(
      cancellationPlan({
        productionStartNotifiedAt: NOTIFIED,
        paidTotal: 5000,
        depositContract: 1250,
        cancelledBy: "seller",
      })
    ).toEqual({ phase: "after_production", refund_amount: 5000, deposit_kept: 0 })
  })

  it("peníze v BigNumber tvaru (query.graph) a haléře", () => {
    expect(
      cancellationPlan({
        productionStartNotifiedAt: new Date(NOTIFIED),
        paidTotal: { value: "2479.5" },
        depositContract: { numeric_: 619.875 },
        cancelledBy: "customer",
      })
    ).toEqual({ phase: "after_production", refund_amount: 1859.62, deposit_kept: 619.88 })
  })

  it("nic nezaplaceno → nic se nevrací ani neponechává", () => {
    expect(
      cancellationPlan({
        productionStartNotifiedAt: NOTIFIED,
        paidTotal: 0,
        depositContract: 1250,
        cancelledBy: "customer",
      })
    ).toEqual({ phase: "after_production", refund_amount: 0, deposit_kept: 0 })
  })
})

describe("cancellationPhaseOf — Z3 je objektivní událost", () => {
  it("null / nesmysl = před zahájením, datum = po zahájení", () => {
    expect(cancellationPhaseOf(null)).toBe("before_production")
    expect(cancellationPhaseOf(undefined)).toBe("before_production")
    expect(cancellationPhaseOf("nedatum")).toBe("before_production")
    expect(cancellationPhaseOf(NOTIFIED)).toBe("after_production")
  })
})

describe("cancellationEligibility — kdy jde zrušit", () => {
  it("živé fáze bez odeslání → jde", () => {
    for (const stage of ["specification_pending", "confirmed", "in_production", "awaiting_balance"]) {
      expect(cancellationEligibility({ stage, goodsShipped: false })).toEqual({
        can_cancel: true,
        blocked_reason: null,
      })
    }
  })

  it("zrušená, hotová a zaplacená, dokončená, odeslaná → nejde, s českým důvodem", () => {
    expect(cancellationEligibility({ stage: "cancelled", goodsShipped: false }).can_cancel).toBe(false)
    expect(cancellationEligibility({ stage: "ready_to_ship", goodsShipped: false }).can_cancel).toBe(false)
    expect(cancellationEligibility({ stage: "completed", goodsShipped: false }).can_cancel).toBe(false)
    const shipped = cancellationEligibility({ stage: "awaiting_balance", goodsShipped: true })
    expect(shipped.can_cancel).toBe(false)
    expect(shipped.blocked_reason).toMatch(/odešla/)
  })
})
