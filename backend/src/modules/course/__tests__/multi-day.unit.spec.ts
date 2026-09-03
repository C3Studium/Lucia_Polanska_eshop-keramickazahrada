import {
  isValidDayKey,
  parseTimeOfDay,
  planMultiDayOccurrences,
} from "../recurrence"
import { pragueWallClockOf } from "../recurrence"

/** The Prague wall clock of an ISO instant, as "YYYY-MM-DD HH:MM". */
const prague = (iso: string): string => {
  const w = pragueWallClockOf(new Date(iso))
  const p = (n: number) => String(n).padStart(2, "0")
  return `${w.year}-${p(w.month)}-${p(w.day)} ${p(w.hour)}:${p(w.minute)}`
}

describe("parseTimeOfDay", () => {
  it("accepts a 24h wall time", () => {
    expect(parseTimeOfDay("17:00")).toEqual({ hour: 17, minute: 0 })
    expect(parseTimeOfDay("09:30")).toEqual({ hour: 9, minute: 30 })
    expect(parseTimeOfDay("00:00")).toEqual({ hour: 0, minute: 0 })
    expect(parseTimeOfDay("23:59")).toEqual({ hour: 23, minute: 59 })
  })

  it("rejects nonsense rather than guessing", () => {
    expect(parseTimeOfDay("24:00")).toBeNull()
    expect(parseTimeOfDay("17:60")).toBeNull()
    expect(parseTimeOfDay("5:00")).toBeNull()
    expect(parseTimeOfDay("")).toBeNull()
  })
})

describe("isValidDayKey", () => {
  it("accepts real days and rejects impossible ones", () => {
    expect(isValidDayKey("2026-02-28")).toBe(true)
    expect(isValidDayKey("2028-02-29")).toBe(true) // leap year
    expect(isValidDayKey("2026-02-30")).toBe(false)
    expect(isValidDayKey("2026-13-01")).toBe(false)
    expect(isValidDayKey("26-01-01")).toBe(false)
  })
})

describe("planMultiDayOccurrences", () => {
  it("turns picked days into instants at the given Prague wall time", () => {
    const plan = planMultiDayOccurrences(
      ["2026-10-16", "2026-10-03", "2026-10-11"],
      "17:00",
      null
    )

    expect(plan.ok).toBe(true)
    expect(plan.occurrences!.map(prague)).toEqual([
      "2026-10-03 17:00",
      "2026-10-11 17:00",
      "2026-10-16 17:00",
    ])
  })

  it("grows a weekly series from every picked day and merges them", () => {
    const plan = planMultiDayOccurrences(
      ["2026-10-03", "2026-10-11"],
      "17:00",
      "2026-10-31"
    )

    expect(plan.occurrences!.map(prague)).toEqual([
      "2026-10-03 17:00",
      "2026-10-10 17:00",
      "2026-10-11 17:00",
      "2026-10-17 17:00",
      "2026-10-18 17:00",
      "2026-10-24 17:00",
      "2026-10-25 17:00",
      "2026-10-31 17:00",
    ])
  })

  it("never creates the same session twice when two series collide", () => {
    // 3 Oct and 10 Oct are a week apart: their weekly series overlap entirely.
    const plan = planMultiDayOccurrences(
      ["2026-10-03", "2026-10-10"],
      "17:00",
      "2026-10-24"
    )

    expect(plan.occurrences!.map(prague)).toEqual([
      "2026-10-03 17:00",
      "2026-10-10 17:00",
      "2026-10-17 17:00",
      "2026-10-24 17:00",
    ])
  })

  it("keeps a picked day that lies past the repeat horizon", () => {
    // The click was explicit — dropping it silently would be the surprise.
    const plan = planMultiDayOccurrences(
      ["2026-10-03", "2026-12-24"],
      "17:00",
      "2026-10-17"
    )

    expect(plan.occurrences!.map(prague)).toEqual([
      "2026-10-03 17:00",
      "2026-10-10 17:00",
      "2026-10-17 17:00",
      "2026-12-24 17:00",
    ])
  })

  it("holds the wall-clock hour across the autumn DST change", () => {
    // Prague leaves summer time on 25 October 2026; a 17:00 course stays 17:00.
    const plan = planMultiDayOccurrences(
      ["2026-10-20"],
      "17:00",
      "2026-11-10"
    )

    expect(plan.occurrences!.map(prague)).toEqual([
      "2026-10-20 17:00",
      "2026-10-27 17:00",
      "2026-11-03 17:00",
      "2026-11-10 17:00",
    ])
  })

  it("caps the union and says so", () => {
    const plan = planMultiDayOccurrences(
      ["2026-01-05", "2026-01-06"],
      "17:00",
      "2027-12-31",
      10
    )

    expect(plan.occurrences).toHaveLength(10)
    expect(plan.truncated).toBe(true)
  })

  it("refuses empty, invalid time and impossible days", () => {
    expect(planMultiDayOccurrences([], "17:00", null).reason).toBe("no_days")
    expect(
      planMultiDayOccurrences(["2026-10-03"], "17:70", null).reason
    ).toBe("invalid_time")
    expect(
      planMultiDayOccurrences(["2026-02-30"], "17:00", null).reason
    ).toBe("invalid_day")
  })
})
