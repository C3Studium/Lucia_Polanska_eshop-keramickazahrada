import { planConsentStamp } from "../order-consent"

/**
 * Razítko souhlasu s OP k objednávce: serverový čas se dopíše jen jednou,
 * jen když souhlas existuje, a chybějící souhlas u objednávky z košíku je
 * poplach (ne blokace) — u ruční objednávky z administrace ne.
 */

const now = new Date("2026-10-15T08:30:00.000Z")

describe("planConsentStamp", () => {
  it("stamps server time when the checkout recorded a consent", () => {
    expect(
      planConsentStamp({
        metadata: {
          terms_version: "2026-10-15",
          terms_accepted_at: "2026-10-15T08:29:57.000Z",
        },
        fromCart: true,
        now,
      })
    ).toEqual({
      action: "stamp",
      patch: { terms_recorded_at: "2026-10-15T08:30:00.000Z" },
    })
  })

  it("sends only the new key (Medusa merges metadata, nothing else is rewritten)", () => {
    const plan = planConsentStamp({
      metadata: { terms_version: "2026-10-15", balikovna_point_zip: "39701" },
      fromCart: true,
      now,
    })
    expect(plan.action).toBe("stamp")
    if (plan.action === "stamp") {
      expect(Object.keys(plan.patch)).toEqual(["terms_recorded_at"])
    }
  })

  it("is idempotent — a re-delivered event does not move the stamp", () => {
    expect(
      planConsentStamp({
        metadata: {
          terms_version: "2026-10-15",
          terms_recorded_at: "2026-10-15T08:30:00.000Z",
        },
        fromCart: true,
        now: new Date("2026-10-15T09:00:00.000Z"),
      })
    ).toEqual({ action: "already-stamped" })
  })

  it("flags a checkout order without a consent record", () => {
    expect(planConsentStamp({ metadata: {}, fromCart: true, now })).toEqual({
      action: "missing",
    })
    expect(
      planConsentStamp({ metadata: { terms_version: "" }, fromCart: true, now })
    ).toEqual({ action: "missing" })
    expect(planConsentStamp({ metadata: null, fromCart: true, now })).toEqual({
      action: "missing",
    })
  })

  it("leaves a manual (draft) order alone", () => {
    expect(planConsentStamp({ metadata: {}, fromCart: false, now })).toEqual({
      action: "manual-order",
    })
  })
})
