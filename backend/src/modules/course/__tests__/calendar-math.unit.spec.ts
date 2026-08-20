import {
  addMonths,
  buildMonthGrid,
  calendarMonthBounds,
  compareMonths,
  dayAriaLabel,
  dayLabel,
  daysInMonth,
  groupTermsByDay,
  mondayIndex,
  monthTitle,
  pragueDayKey,
  seatsLeftLabel,
  termCountLabel,
} from "../../../../../storefront/src/lib/util/course-calendar"

/**
 * The reservation calendar's month math lives in the storefront
 * (`storefront/src/lib/util/course-calendar.ts`) as a pure, dependency-free
 * module — but the storefront has no unit runner (only Playwright e2e), and
 * calendar arithmetic is exactly what breaks silently in February or across
 * a DST boundary. So the backend's jest gate imports the file directly and
 * pins it here: same `npm run test:unit`, no logic duplicated.
 */

describe("pragueDayKey", () => {
  it("buckets an instant into its Prague calendar day, not UTC's", () => {
    // 23:30 UTC in summer is 01:30 *the next day* in Prague (UTC+2).
    expect(pragueDayKey("2026-08-14T23:30:00Z")).toBe("2026-08-15")
    // Winter (UTC+1): 23:30 UTC is 00:30 next day too.
    expect(pragueDayKey("2026-01-14T23:30:00Z")).toBe("2026-01-15")
    // Mid-day stays put.
    expect(pragueDayKey("2026-08-14T10:00:00Z")).toBe("2026-08-14")
  })

  it("keeps the day steady across the Prague DST transitions", () => {
    // Spring forward — Sunday 2026-03-29, 02:00 CET jumps to 03:00 CEST.
    expect(pragueDayKey("2026-03-28T23:30:00Z")).toBe("2026-03-29") // 00:30 CET
    expect(pragueDayKey("2026-03-29T00:30:00Z")).toBe("2026-03-29") // 01:30 CET, pre-jump
    expect(pragueDayKey("2026-03-29T01:30:00Z")).toBe("2026-03-29") // 03:30 CEST, post-jump
    expect(pragueDayKey("2026-03-29T21:59:00Z")).toBe("2026-03-29") // 23:59 CEST
    expect(pragueDayKey("2026-03-29T22:30:00Z")).toBe("2026-03-30")
    // Fall back — Sunday 2026-10-25, 03:00 CEST returns to 02:00 CET.
    expect(pragueDayKey("2026-10-24T22:30:00Z")).toBe("2026-10-25") // 00:30 CEST
    expect(pragueDayKey("2026-10-25T01:30:00Z")).toBe("2026-10-25") // the doubled hour
    expect(pragueDayKey("2026-10-25T22:59:00Z")).toBe("2026-10-25") // 23:59 CET
    expect(pragueDayKey("2026-10-25T23:30:00Z")).toBe("2026-10-26")
  })
})

describe("month arithmetic", () => {
  it("knows month lengths — including leap February", () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2026, 9)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it("wraps addMonths across year boundaries in both directions", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    })
    expect(addMonths({ year: 2026, month: 8 }, 17)).toEqual({
      year: 2028,
      month: 1,
    })
  })

  it("orders months", () => {
    expect(
      compareMonths({ year: 2026, month: 8 }, { year: 2026, month: 9 })
    ).toBeLessThan(0)
    expect(
      compareMonths({ year: 2027, month: 1 }, { year: 2026, month: 12 })
    ).toBeGreaterThan(0)
    expect(
      compareMonths({ year: 2026, month: 8 }, { year: 2026, month: 8 })
    ).toBe(0)
  })

  it("indexes weekdays Monday-first", () => {
    // 2026-08-20 is a Thursday.
    expect(mondayIndex(2026, 8, 20)).toBe(3)
    // 2026-08-17 is a Monday, 2026-08-23 a Sunday.
    expect(mondayIndex(2026, 8, 17)).toBe(0)
    expect(mondayIndex(2026, 8, 23)).toBe(6)
  })
})

describe("buildMonthGrid", () => {
  it("pads the first week to Monday and the last to a full row", () => {
    // September 2026 starts on a Tuesday (1 pad) and has 30 days.
    const weeks = buildMonthGrid(2026, 9)
    expect(weeks[0][0]).toBeNull()
    expect(weeks[0][1]).toEqual({ key: "2026-09-01", day: 1 })
    const cells = weeks.flat()
    expect(cells.length % 7).toBe(0)
    expect(cells.filter(Boolean)).toHaveLength(30)
    const last = [...cells].reverse().find(Boolean)
    expect(last).toEqual({ key: "2026-09-30", day: 30 })
  })

  it("handles a month starting on Monday with zero padding", () => {
    // June 2026 starts on a Monday.
    const weeks = buildMonthGrid(2026, 6)
    expect(weeks[0][0]).toEqual({ key: "2026-06-01", day: 1 })
  })
})

describe("Czech labels", () => {
  it("speaks the day in Czech with the genitive month", () => {
    // 2026-09-15 is a Tuesday.
    expect(dayLabel("2026-09-15")).toBe("úterý 15. září")
    expect(monthTitle({ year: 2026, month: 9 })).toBe("září 2026")
  })

  it("declines seats and term counts", () => {
    expect(seatsLeftLabel(0)).toBe("obsazeno")
    expect(seatsLeftLabel(1)).toBe("zbývá 1 místo")
    expect(seatsLeftLabel(3)).toBe("zbývají 3 místa")
    expect(seatsLeftLabel(5)).toBe("zbývá 5 míst")
    expect(termCountLabel(1)).toBe("1 termín")
    expect(termCountLabel(2)).toBe("2 termíny")
    expect(termCountLabel(5)).toBe("5 termínů")
  })

  it("builds the day aria-label the audit asked for", () => {
    const day = "2026-09-15"
    expect(
      dayAriaLabel(day, [
        { starts_at: "2026-09-15T08:00:00Z", seats_left: 3, sold_out: false },
      ])
    ).toBe("úterý 15. září — 1 termín, zbývají 3 místa")
    expect(
      dayAriaLabel(day, [
        { starts_at: "2026-09-15T08:00:00Z", seats_left: 0, sold_out: true },
      ])
    ).toBe("úterý 15. září — 1 termín, obsazeno")
    expect(dayAriaLabel(day, [])).toBe("úterý 15. září — žádný termín")
  })
})

describe("terms on the grid", () => {
  it("groups terms by their Prague day", () => {
    const byDay = groupTermsByDay([
      { starts_at: "2026-09-14T23:30:00Z", seats_left: 2, sold_out: false },
      { starts_at: "2026-09-15T08:00:00Z", seats_left: 4, sold_out: false },
      { starts_at: "2026-09-20T08:00:00Z", seats_left: 0, sold_out: true },
    ])
    // The first term is already the 15th in Prague.
    expect(byDay.get("2026-09-15")).toHaveLength(2)
    expect(byDay.get("2026-09-20")).toHaveLength(1)
    expect(byDay.has("2026-09-14")).toBe(false)
  })

  it("bounds the calendar from the current month to the last term's month — never less", () => {
    const now = new Date("2026-08-20T10:00:00Z")
    expect(
      calendarMonthBounds(
        [
          { starts_at: "2026-09-15T08:00:00Z" },
          { starts_at: "2026-11-02T08:00:00Z" },
        ],
        now
      )
    ).toEqual({
      first: { year: 2026, month: 8 },
      last: { year: 2026, month: 11 },
    })
    // No terms: the current month alone.
    expect(calendarMonthBounds([], now)).toEqual({
      first: { year: 2026, month: 8 },
      last: { year: 2026, month: 8 },
    })
  })
})
