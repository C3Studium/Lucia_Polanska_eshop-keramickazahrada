/**
 * Month math and Czech labels for the course-reservation calendar.
 *
 * Deliberately dependency-free and pure (no date library, no React): the
 * reservation modal renders from these, and the backend's unit gate exercises
 * them (see `backend/src/modules/course/__tests__/calendar-math.unit.spec.ts`
 * — the storefront has no unit runner, and untested calendar arithmetic is
 * exactly the kind of thing that quietly breaks in February).
 *
 * Timezone semantics match the rest of the kurzy surface: a term belongs to
 * the calendar day its `starts_at` falls on **in Europe/Prague** — the same
 * day the customer sees in `formatPrague` next to it. Weekday arithmetic then
 * runs on plain calendar dates (year/month/day), which is timezone-free.
 */

export const PRAGUE_TZ = "Europe/Prague"

/** A calendar month; `month` is 1–12 like humans count. */
export type CalendarMonth = { year: number; month: number }

/** One grid cell: a day of the shown month, or null padding around it. */
export type CalendarCell = { key: string; day: number } | null

const pad2 = (value: number): string => String(value).padStart(2, "0")

/** "YYYY-MM-DD" of the instant `iso`, in Prague local time. */
export const pragueDayKey = (iso: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: PRAGUE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))

/** The Prague calendar month an instant falls in. */
export const pragueMonthOf = (iso: string): CalendarMonth => {
  const [year, month] = pragueDayKey(iso).split("-").map(Number)
  return { year, month }
}

export const dayKeyOf = (year: number, month: number, day: number): string =>
  `${year}-${pad2(month)}-${pad2(day)}`

export const parseDayKey = (
  key: string
): { year: number; month: number; day: number } => {
  const [year, month, day] = key.split("-").map(Number)
  return { year, month, day }
}

export const addMonths = (
  base: CalendarMonth,
  delta: number
): CalendarMonth => {
  const index = base.year * 12 + (base.month - 1) + delta
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 }
}

/** Negative when `a` is earlier, zero when equal, positive when later. */
export const compareMonths = (a: CalendarMonth, b: CalendarMonth): number =>
  a.year * 12 + a.month - (b.year * 12 + b.month)

export const daysInMonth = (year: number, month: number): number =>
  // Day 0 of the next month is this month's last day; UTC keeps it pure.
  new Date(Date.UTC(year, month, 0)).getUTCDate()

/**
 * Monday-first weekday index (0 = pondělí … 6 = neděle) of a calendar date.
 * The weekday of a plain date is timezone-independent, so UTC arithmetic is
 * exact here.
 */
export const mondayIndex = (
  year: number,
  month: number,
  day: number
): number => (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7

/**
 * The month as rows of seven, Monday-first, padded with nulls before the 1st
 * and after the last day — what the grid renders row by row.
 */
export const buildMonthGrid = (
  year: number,
  month: number
): CalendarCell[][] => {
  const lead = mondayIndex(year, month, 1)
  const total = daysInMonth(year, month)
  const cells: CalendarCell[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => ({
      key: dayKeyOf(year, month, i + 1),
      day: i + 1,
    })),
  ]
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }
  const weeks: CalendarCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}

/* ------------------------------------------------------------------------- */
/* Czech labels                                                              */
/* ------------------------------------------------------------------------- */

export const CZECH_MONTHS = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
] as const

/** Genitive forms for „15. září" style labels. */
export const CZECH_MONTHS_GENITIVE = [
  "ledna",
  "února",
  "března",
  "dubna",
  "května",
  "června",
  "července",
  "srpna",
  "září",
  "října",
  "listopadu",
  "prosince",
] as const

/** Monday-first, matching `mondayIndex`. */
export const CZECH_WEEKDAYS = [
  { short: "po", long: "pondělí" },
  { short: "út", long: "úterý" },
  { short: "st", long: "středa" },
  { short: "čt", long: "čtvrtek" },
  { short: "pá", long: "pátek" },
  { short: "so", long: "sobota" },
  { short: "ne", long: "neděle" },
] as const

export const monthTitle = (month: CalendarMonth): string =>
  `${CZECH_MONTHS[month.month - 1]} ${month.year}`

/** „úterý 15. září" for a day key. */
export const dayLabel = (key: string): string => {
  const { year, month, day } = parseDayKey(key)
  return `${CZECH_WEEKDAYS[mondayIndex(year, month, day)].long} ${day}. ${
    CZECH_MONTHS_GENITIVE[month - 1]
  }`
}

export const seatsLeftLabel = (left: number): string =>
  left <= 0
    ? "obsazeno"
    : left === 1
      ? "zbývá 1 místo"
      : left < 5
        ? `zbývají ${left} místa`
        : `zbývá ${left} míst`

export const termCountLabel = (count: number): string =>
  count === 1 ? "1 termín" : count < 5 ? `${count} termíny` : `${count} termínů`

/* ------------------------------------------------------------------------- */
/* Terms on the grid                                                         */
/* ------------------------------------------------------------------------- */

export type CalendarTerm = {
  starts_at: string
  seats_left: number
  sold_out: boolean
}

/** Terms bucketed by their Prague day key. */
export const groupTermsByDay = <T extends CalendarTerm>(
  terms: T[]
): Map<string, T[]> => {
  const byDay = new Map<string, T[]>()
  for (const term of terms) {
    const key = pragueDayKey(term.starts_at)
    const bucket = byDay.get(key)
    if (bucket) {
      bucket.push(term)
    } else {
      byDay.set(key, [term])
    }
  }
  return byDay
}

/**
 * What a screen reader hears on a day cell:
 * „úterý 15. září — 1 termín, zbývají 3 místa" / „…— obsazeno" /
 * „středa 16. září — žádný termín".
 */
export const dayAriaLabel = (key: string, terms: CalendarTerm[]): string => {
  if (!terms.length) {
    return `${dayLabel(key)} — žádný termín`
  }
  const open = terms.filter((term) => !term.sold_out)
  const seats = open.reduce((sum, term) => sum + Math.max(0, term.seats_left), 0)
  return `${dayLabel(key)} — ${termCountLabel(terms.length)}, ${
    open.length ? seatsLeftLabel(seats) : "obsazeno"
  }`
}

/**
 * The months the calendar may show: from the current Prague month to the last
 * month carrying a term — never less than the current month itself.
 */
export const calendarMonthBounds = (
  terms: { starts_at: string }[],
  now: Date
): { first: CalendarMonth; last: CalendarMonth } => {
  const first = pragueMonthOf(now.toISOString())
  let last = first
  for (const term of terms) {
    const month = pragueMonthOf(term.starts_at)
    if (compareMonths(month, last) > 0) {
      last = month
    }
  }
  return { first, last }
}
