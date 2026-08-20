import {
  CZECH_WEEKLY_PHRASES,
  MAX_OCCURRENCES,
  horizonEndDayKey,
  mondayIndexOf,
  normalizeUntilDayKey,
  planWeeklyOccurrences,
  pragueWallClockOf,
  utcFromPragueWallClock,
} from "../recurrence"

/**
 * Weekly recurrence, pinned — the same function feeds the drawer preview and
 * the terms route, so these cases are the contract for both at once.
 *
 * The load-bearing property: „každý týden v 17:00" means 17:00 on Prague's
 * clock, week after week, across both DST changeovers. In 2026 the clocks
 * jump forward on Sunday 2026-03-29 and fall back on Sunday 2026-10-25.
 */

describe("Prague wall-clock anchoring", () => {
  it("reads an instant as Prague wall time", () => {
    // Summer (UTC+2): 15:00Z is 17:00 in Prague.
    expect(pragueWallClockOf(new Date("2026-08-18T15:00:00Z"))).toEqual({
      year: 2026,
      month: 8,
      day: 18,
      hour: 17,
      minute: 0,
      second: 0,
    })
    // Winter (UTC+1): 16:00Z is 17:00 in Prague.
    expect(pragueWallClockOf(new Date("2026-01-13T16:00:00Z"))).toEqual({
      year: 2026,
      month: 1,
      day: 13,
      hour: 17,
      minute: 0,
      second: 0,
    })
  })

  it("re-anchors a wall time to the correct instant on both sides of DST", () => {
    const at17 = (year: number, month: number, day: number) =>
      utcFromPragueWallClock({
        year,
        month,
        day,
        hour: 17,
        minute: 0,
        second: 0,
      }).toISOString()
    expect(at17(2026, 3, 28)).toBe("2026-03-28T16:00:00.000Z") // CET
    expect(at17(2026, 3, 29)).toBe("2026-03-29T15:00:00.000Z") // CEST, same day as the jump
    expect(at17(2026, 10, 24)).toBe("2026-10-24T15:00:00.000Z") // CEST
    expect(at17(2026, 10, 25)).toBe("2026-10-25T16:00:00.000Z") // CET again
  })
})

describe("planWeeklyOccurrences", () => {
  it("keeps 17:00 Prague across the spring-forward week (2026-03-29)", () => {
    // Tuesday 2026-03-24 17:00 Prague is still CET → 16:00Z.
    const plan = planWeeklyOccurrences("2026-03-24T16:00:00Z", "2026-04-07")
    expect(plan).toEqual({
      ok: true,
      truncated: false,
      occurrences: [
        "2026-03-24T16:00:00.000Z", // 17:00 CET
        "2026-03-31T15:00:00.000Z", // 17:00 CEST — the UTC instant shifted, the wall clock did not
        "2026-04-07T15:00:00.000Z",
      ],
    })
  })

  it("keeps 17:00 Prague across the fall-back week (2026-10-25)", () => {
    // Tuesday 2026-10-20 17:00 Prague is CEST → 15:00Z.
    const plan = planWeeklyOccurrences("2026-10-20T15:00:00Z", "2026-11-03")
    expect(plan).toEqual({
      ok: true,
      truncated: false,
      occurrences: [
        "2026-10-20T15:00:00.000Z", // 17:00 CEST
        "2026-10-27T16:00:00.000Z", // 17:00 CET
        "2026-11-03T16:00:00.000Z",
      ],
    })
  })

  it("starts with the original instant and steps whole weeks", () => {
    const plan = planWeeklyOccurrences("2026-09-01T15:00:00Z", "2026-09-30")
    expect(plan.ok).toBe(true)
    if (plan.ok) {
      expect(plan.occurrences[0]).toBe("2026-09-01T15:00:00.000Z")
      // Tuesdays: 1., 8., 15., 22., 29. September.
      expect(plan.occurrences).toHaveLength(5)
    }
  })

  it("includes an occurrence landing exactly on the custom end day", () => {
    const plan = planWeeklyOccurrences("2026-09-01T15:00:00Z", "2026-09-15")
    expect(plan.ok).toBe(true)
    if (plan.ok) {
      expect(plan.occurrences).toHaveLength(3)
      expect(plan.occurrences[2]).toBe("2026-09-15T15:00:00.000Z")
    }
  })

  it("caps at 60 occurrences and says so", () => {
    const plan = planWeeklyOccurrences("2026-01-06T16:00:00Z", "2027-12-31")
    expect(plan.ok).toBe(true)
    if (plan.ok) {
      expect(plan.occurrences).toHaveLength(MAX_OCCURRENCES)
      expect(plan.truncated).toBe(true)
      // 59 weeks after 2026-01-06 is Tuesday 2027-02-23 — still CET.
      expect(plan.occurrences[59]).toBe("2027-02-23T16:00:00.000Z")
    }
  })

  it("refuses an end before the start", () => {
    expect(planWeeklyOccurrences("2026-09-01T15:00:00Z", "2026-08-31")).toEqual(
      { ok: false, reason: "until_before_start" }
    )
  })

  it("treats an end on the very start day as a single term", () => {
    const plan = planWeeklyOccurrences("2026-09-01T15:00:00Z", "2026-09-01")
    expect(plan).toEqual({
      ok: true,
      truncated: false,
      occurrences: ["2026-09-01T15:00:00.000Z"],
    })
  })

  it("refuses an unparseable start", () => {
    expect(planWeeklyOccurrences("neplatné", "2026-09-01")).toEqual({
      ok: false,
      reason: "invalid_start",
    })
  })

  it("buckets by the Prague day even when UTC disagrees", () => {
    // 23:30 Prague summer time is 21:30Z — UTC still thinks it is the 31st,
    // Prague already writes 1. 9.; „tento měsíc" must follow Prague.
    const startsAt = "2026-08-31T21:30:00Z" // 23:30 Prague, Monday 31. 8.
    expect(horizonEndDayKey(startsAt, "tento_mesic")).toBe("2026-08-31")
    const plan = planWeeklyOccurrences(startsAt, "2026-08-31")
    expect(plan.ok).toBe(true)
    if (plan.ok) {
      expect(plan.occurrences).toEqual(["2026-08-31T21:30:00.000Z"])
    }
  })
})

describe("horizonEndDayKey", () => {
  const startsAt = "2026-08-20T15:00:00Z" // Thursday 20. 8. 2026, 17:00 Prague

  it("ends „tento měsíc“ with the month's last day", () => {
    expect(horizonEndDayKey(startsAt, "tento_mesic")).toBe("2026-08-31")
  })

  it("steps +3/+6/+12 months on the same day of month", () => {
    expect(horizonEndDayKey(startsAt, "ctvrt_roku")).toBe("2026-11-20")
    expect(horizonEndDayKey(startsAt, "pul_roku")).toBe("2027-02-20")
    expect(horizonEndDayKey(startsAt, "rok")).toBe("2027-08-20")
  })

  it("clamps a 31st start to shorter target months instead of spilling over", () => {
    const on31st = "2026-01-31T16:00:00Z" // Saturday 31. 1. 2026
    expect(horizonEndDayKey(on31st, "tento_mesic")).toBe("2026-01-31")
    expect(horizonEndDayKey(on31st, "ctvrt_roku")).toBe("2026-04-30")
    expect(horizonEndDayKey(on31st, "rok")).toBe("2027-01-31")
    // +6 from 31. 8. lands in a 28-day February.
    expect(horizonEndDayKey("2026-08-31T15:00:00Z", "pul_roku")).toBe(
      "2027-02-28"
    )
  })

  it("a „tento měsíc“ start on the 31st creates exactly one term", () => {
    const plan = planWeeklyOccurrences(
      "2026-01-31T16:00:00Z",
      horizonEndDayKey("2026-01-31T16:00:00Z", "tento_mesic")
    )
    expect(plan).toEqual({
      ok: true,
      truncated: false,
      occurrences: ["2026-01-31T16:00:00.000Z"],
    })
  })
})

describe("normalizeUntilDayKey", () => {
  it("passes a plain calendar day through", () => {
    expect(normalizeUntilDayKey("2026-11-24")).toBe("2026-11-24")
  })

  it("rejects impossible calendar days", () => {
    expect(normalizeUntilDayKey("2026-02-30")).toBeNull()
    expect(normalizeUntilDayKey("2026-13-01")).toBeNull()
  })

  it("buckets a full instant into its Prague day", () => {
    // 23:30Z in November is already 00:30 next day in Prague.
    expect(normalizeUntilDayKey("2026-11-24T23:30:00Z")).toBe("2026-11-25")
    expect(normalizeUntilDayKey("2026-11-24T10:00:00Z")).toBe("2026-11-24")
  })

  it("rejects garbage", () => {
    expect(normalizeUntilDayKey("za měsíc")).toBeNull()
  })
})

describe("Czech weekly phrases", () => {
  it("matches Monday-first weekday indexing with the right grammar", () => {
    // 2026-08-18 is a Tuesday, 2026-08-19 a Wednesday.
    expect(
      CZECH_WEEKLY_PHRASES[mondayIndexOf({ year: 2026, month: 8, day: 18 })]
    ).toBe("každé úterý")
    expect(
      CZECH_WEEKLY_PHRASES[mondayIndexOf({ year: 2026, month: 8, day: 19 })]
    ).toBe("každou středu")
    expect(
      CZECH_WEEKLY_PHRASES[mondayIndexOf({ year: 2026, month: 8, day: 20 })]
    ).toBe("každý čtvrtek")
  })
})
