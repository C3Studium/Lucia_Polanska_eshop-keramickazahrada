import { isEligibleRecipient, subscriberState } from "../newsletter-recipients"

/**
 * The consent predicate. Every campaign sender and the admin's recipient
 * count run through these two functions — a wrong answer here is either an
 * illegal e-mail (sent without confirmed consent) or a silently shrunken
 * audience. Zák. č. 480/2004 Sb.: only a *confirmed*, *not-unsubscribed*
 * address with an actual e-mail may be written to.
 */
describe("isEligibleRecipient (confirmed-only campaign filter)", () => {
  const confirmed = {
    email: "jana@example.com",
    confirmed_at: new Date("2026-08-01"),
    unsubscribed_at: null,
  }

  it("accepts a confirmed, active subscriber", () => {
    expect(isEligibleRecipient(confirmed)).toBe(true)
  })

  it("rejects a pending subscriber — signup alone is not consent evidence", () => {
    expect(
      isEligibleRecipient({ ...confirmed, confirmed_at: null })
    ).toBe(false)
  })

  it("rejects anyone who unsubscribed, even if they once confirmed", () => {
    expect(
      isEligibleRecipient({
        ...confirmed,
        unsubscribed_at: new Date("2026-08-10"),
      })
    ).toBe(false)
  })

  it("rejects blank or missing addresses", () => {
    expect(isEligibleRecipient({ ...confirmed, email: "   " })).toBe(false)
    expect(isEligibleRecipient({ ...confirmed, email: null })).toBe(false)
    expect(isEligibleRecipient(null)).toBe(false)
    expect(isEligibleRecipient(undefined)).toBe(false)
  })

  it("accepts ISO-string timestamps as stored rows sometimes carry", () => {
    expect(
      isEligibleRecipient({
        email: "jana@example.com",
        confirmed_at: "2026-08-01T10:00:00Z",
        unsubscribed_at: null,
      })
    ).toBe(true)
  })
})

describe("subscriberState", () => {
  it("labels the three states the admin shows", () => {
    expect(
      subscriberState({ confirmed_at: new Date(), unsubscribed_at: null })
    ).toBe("confirmed")
    expect(
      subscriberState({ confirmed_at: null, unsubscribed_at: null })
    ).toBe("pending")
    expect(
      subscriberState({ confirmed_at: new Date(), unsubscribed_at: new Date() })
    ).toBe("unsubscribed")
  })

  it("unsubscribed wins over everything else", () => {
    expect(
      subscriberState({ confirmed_at: null, unsubscribed_at: new Date() })
    ).toBe("unsubscribed")
  })
})
