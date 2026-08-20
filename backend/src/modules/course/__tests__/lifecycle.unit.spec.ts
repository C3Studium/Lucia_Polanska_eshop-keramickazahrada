import {
  canAttemptCourseRefund,
  courseExpiredKey,
  courseReminderCallListKey,
  courseReminderKey,
  courseWaitlistKey,
  expiryCutoff,
  hasTermEnded,
  isInReminderWindow,
  pickRefundablePayment,
  refundSequentially,
  reminderWindow,
  shouldAutoExpire,
  termEndsAt,
  waitlistEntriesToNotify,
} from "../lifecycle"

/**
 * The time and eligibility rules of the course completion features, pinned.
 *
 * Same reasoning as pricing.unit.spec.ts one directory over: these functions
 * decide who gets cancelled, reminded, refunded and notified — a behavior
 * change here is a cancelled seat or a doubled e-mail for a real customer.
 */

const NOW = new Date("2026-08-19T10:00:00Z")
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs)

/* ------------------------------------------------------------------------- */
/* Auto-expiry                                                               */
/* ------------------------------------------------------------------------- */

describe("shouldAutoExpire", () => {
  const unpaid = (createdOffsetMs: number) => ({
    payment_method: "online",
    payment_status: "pending",
    status: "active",
    paid_at: null,
    created_at: at(createdOffsetMs).toISOString(),
  })

  it("expires an unpaid online reservation older than 24 hours", () => {
    expect(shouldAutoExpire(unpaid(-25 * HOUR), NOW)).toBe(true)
  })

  it("expires exactly at the 24 hour mark, not before", () => {
    expect(shouldAutoExpire(unpaid(-24 * HOUR), NOW)).toBe(true)
    expect(shouldAutoExpire(unpaid(-24 * HOUR + 60 * 1000), NOW)).toBe(false)
  })

  it("leaves a reservation created 23 hours ago alone", () => {
    expect(shouldAutoExpire(unpaid(-23 * HOUR), NOW)).toBe(false)
  })

  it("never touches pay-on-site reservations, however old", () => {
    expect(
      shouldAutoExpire(
        { ...unpaid(-30 * DAY), payment_method: "on_site", payment_status: "on_site" },
        NOW
      )
    ).toBe(false)
  })

  it("never touches a paid reservation — by status or by paid_at", () => {
    expect(
      shouldAutoExpire({ ...unpaid(-48 * HOUR), payment_status: "paid" }, NOW)
    ).toBe(false)
    // The race guard: payment_status not yet flipped but paid_at stamped.
    expect(
      shouldAutoExpire(
        { ...unpaid(-48 * HOUR), paid_at: at(-1 * HOUR).toISOString() },
        NOW
      )
    ).toBe(false)
  })

  it("never touches an already-cancelled reservation", () => {
    expect(
      shouldAutoExpire({ ...unpaid(-48 * HOUR), status: "cancelled" }, NOW)
    ).toBe(false)
  })

  it("refuses a row with an unreadable created_at", () => {
    expect(
      shouldAutoExpire({ ...unpaid(-48 * HOUR), created_at: "not-a-date" }, NOW)
    ).toBe(false)
  })

  it("cutoff is exactly 24 hours back", () => {
    expect(expiryCutoff(NOW).getTime()).toBe(NOW.getTime() - 24 * HOUR)
  })
})

/* ------------------------------------------------------------------------- */
/* Reminder window                                                           */
/* ------------------------------------------------------------------------- */

describe("reminder window", () => {
  it("spans now+1d to now+3d — two days wide so one missed run cannot lose a term", () => {
    const { from, to } = reminderWindow(NOW)
    expect(from.getTime()).toBe(NOW.getTime() + 1 * DAY)
    expect(to.getTime()).toBe(NOW.getTime() + 3 * DAY)
  })

  it("catches a term two and a half days out", () => {
    expect(isInReminderWindow(at(2.5 * DAY).toISOString(), NOW)).toBe(true)
  })

  it("still catches a term on its second morning (1–2 days out)", () => {
    // Normally deduped by the per-reservation key; only matters when the
    // previous morning's run failed — then this is the safety net.
    expect(isInReminderWindow(at(1.5 * DAY).toISOString(), NOW)).toBe(true)
  })

  it("includes both edges — a late job still catches every term once", () => {
    expect(isInReminderWindow(at(1 * DAY).toISOString(), NOW)).toBe(true)
    expect(isInReminderWindow(at(3 * DAY).toISOString(), NOW)).toBe(true)
  })

  it("leaves later today and next week alone", () => {
    expect(isInReminderWindow(at(0.5 * DAY).toISOString(), NOW)).toBe(false)
    expect(isInReminderWindow(at(7 * DAY).toISOString(), NOW)).toBe(false)
  })

  it("refuses garbage dates", () => {
    expect(isInReminderWindow("not-a-date", NOW)).toBe(false)
  })
})

/* ------------------------------------------------------------------------- */
/* Auto-finish cutoff                                                        */
/* ------------------------------------------------------------------------- */

describe("hasTermEnded", () => {
  it("a term with a duration ends at starts_at + duration", () => {
    const term = {
      starts_at: at(-2 * HOUR).toISOString(),
      duration_minutes: 180,
    }
    // Started 2h ago, runs 3h — still happening.
    expect(hasTermEnded(term, NOW)).toBe(false)
    expect(termEndsAt(term)!.getTime()).toBe(NOW.getTime() + 1 * HOUR)
  })

  it("a term with a duration is finished once the duration has run out", () => {
    expect(
      hasTermEnded(
        { starts_at: at(-4 * HOUR).toISOString(), duration_minutes: 180 },
        NOW
      )
    ).toBe(true)
  })

  it("a term without a duration ends the moment it starts", () => {
    expect(
      hasTermEnded({ starts_at: at(-1).toISOString(), duration_minutes: null }, NOW)
    ).toBe(true)
    expect(
      hasTermEnded({ starts_at: at(1 * HOUR).toISOString(), duration_minutes: null }, NOW)
    ).toBe(false)
  })

  it("treats the exact end moment as ended (idempotent boundary)", () => {
    expect(
      hasTermEnded(
        { starts_at: at(-3 * HOUR).toISOString(), duration_minutes: 180 },
        NOW
      )
    ).toBe(true)
  })

  it("never finishes a term with an unreadable start", () => {
    expect(hasTermEnded({ starts_at: "kdovíkdy", duration_minutes: 60 }, NOW)).toBe(
      false
    )
  })
})

/* ------------------------------------------------------------------------- */
/* Refund guards                                                             */
/* ------------------------------------------------------------------------- */

describe("canAttemptCourseRefund", () => {
  const paid = {
    payment_method: "online",
    payment_status: "paid",
    payment_collection_id: "paycol_1",
    refunded_at: null,
  }

  it("allows a paid online reservation with a collection", () => {
    expect(canAttemptCourseRefund(paid)).toBe(true)
  })

  it("never refunds twice — refunded_at blocks every retry", () => {
    expect(
      canAttemptCourseRefund({ ...paid, refunded_at: "2026-08-19T09:00:00Z" })
    ).toBe(false)
  })

  it("refuses unpaid, on-site and collection-less rows", () => {
    expect(canAttemptCourseRefund({ ...paid, payment_status: "pending" })).toBe(false)
    expect(
      canAttemptCourseRefund({
        ...paid,
        payment_method: "on_site",
        payment_status: "on_site",
      })
    ).toBe(false)
    expect(
      canAttemptCourseRefund({ ...paid, payment_collection_id: null })
    ).toBe(false)
  })
})

describe("pickRefundablePayment", () => {
  const COMGATE = "pp_comgate_comgate"

  it("picks the captured, uncancelled ComGate payment", () => {
    const wanted = {
      id: "pay_2",
      provider_id: COMGATE,
      captured_at: "2026-08-18T10:00:00Z",
      canceled_at: null,
    }
    expect(
      pickRefundablePayment(
        [
          { id: "pay_1", provider_id: COMGATE, captured_at: null, canceled_at: null },
          wanted,
        ],
        COMGATE
      )
    ).toBe(wanted)
  })

  it("refuses foreign providers, uncaptured and cancelled payments", () => {
    expect(
      pickRefundablePayment(
        [
          { id: "a", provider_id: "pp_system_default", captured_at: "x", canceled_at: null },
          { id: "b", provider_id: COMGATE, captured_at: null, canceled_at: null },
          { id: "c", provider_id: COMGATE, captured_at: "x", canceled_at: "y" },
        ],
        COMGATE
      )
    ).toBeNull()
    expect(pickRefundablePayment([], COMGATE)).toBeNull()
  })
})

describe("refundSequentially", () => {
  it("isolates a throwing refund — the rest still run", async () => {
    const attempts: string[] = []
    const result = await refundSequentially(
      [{ id: "r1" }, { id: "r2" }, { id: "r3" }],
      async (reservation) => {
        attempts.push(reservation.id)
        if (reservation.id === "r2") {
          throw new Error("provider down")
        }
        return true
      }
    )
    expect(attempts).toEqual(["r1", "r2", "r3"])
    expect(result.refunded.map((r) => r.id)).toEqual(["r1", "r3"])
    expect(result.failed.map((r) => r.id)).toEqual(["r2"])
  })

  it("counts a false return as failed (manual territory), not refunded", async () => {
    const result = await refundSequentially(
      [{ id: "r1" }, { id: "r2" }],
      async (reservation) => reservation.id === "r1"
    )
    expect(result.refunded.map((r) => r.id)).toEqual(["r1"])
    expect(result.failed.map((r) => r.id)).toEqual(["r2"])
  })
})

/* ------------------------------------------------------------------------- */
/* Waitlist fit                                                              */
/* ------------------------------------------------------------------------- */

describe("waitlistEntriesToNotify", () => {
  const entry = (
    id: string,
    partySize: number,
    createdOffsetMs: number,
    notified = false
  ) => ({
    id,
    party_size: partySize,
    created_at: at(createdOffsetMs).toISOString(),
    notified_at: notified ? at(createdOffsetMs + HOUR).toISOString() : null,
  })

  it("notifies every entry whose whole party fits, oldest first", () => {
    const result = waitlistEntriesToNotify(
      [entry("late", 1, -1 * DAY), entry("early", 2, -3 * DAY), entry("big", 4, -2 * DAY)],
      2
    )
    expect(result.map((e) => e.id)).toEqual(["early", "late"])
  })

  it("holds back a party larger than the free seats", () => {
    expect(
      waitlistEntriesToNotify([entry("four", 4, -1 * DAY)], 3).map((e) => e.id)
    ).toEqual([])
    expect(
      waitlistEntriesToNotify([entry("four", 4, -1 * DAY)], 4).map((e) => e.id)
    ).toEqual(["four"])
  })

  it("skips entries already notified — one e-mail per entry, ever", () => {
    expect(
      waitlistEntriesToNotify(
        [entry("done", 1, -3 * DAY, true), entry("waiting", 1, -1 * DAY)],
        5
      ).map((e) => e.id)
    ).toEqual(["waiting"])
  })

  it("does nothing when no seats are free", () => {
    expect(waitlistEntriesToNotify([entry("a", 1, -1 * DAY)], 0)).toEqual([])
    expect(waitlistEntriesToNotify([entry("a", 1, -1 * DAY)], -2)).toEqual([])
  })

  it("ignores nonsense party sizes instead of notifying them", () => {
    expect(
      waitlistEntriesToNotify(
        [{ id: "weird", party_size: 0, created_at: NOW.toISOString(), notified_at: null }],
        5
      )
    ).toEqual([])
  })
})

/* ------------------------------------------------------------------------- */
/* Idempotency keys                                                          */
/* ------------------------------------------------------------------------- */

describe("idempotency keys", () => {
  it("match the documented shapes exactly", () => {
    expect(courseExpiredKey("res_1")).toBe("course-expired:res_1")
    expect(courseReminderKey("res_1")).toBe("course-reminder:res_1")
    expect(courseReminderCallListKey("term_1")).toBe(
      "course-reminder-calllist:term_1"
    )
    expect(courseWaitlistKey("wl_1")).toBe("course-waitlist:wl_1")
  })
})
