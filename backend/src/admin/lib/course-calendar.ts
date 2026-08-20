/**
 * Month math and Czech labels for the admin course calendar.
 *
 * SOURCE-OF-TRUTH TWIN: `storefront/src/lib/util/course-calendar.ts` — the
 * customer-facing reservation calendar. Admin UI code cannot import across
 * projects (the vite admin bundle only sees the backend), so the needed pure
 * helpers are copied here verbatim — the same arrangement the e-mail identity
 * constants use. If a rule changes (grid math, day bucketing, Czech names),
 * change it THERE first and mirror it here; the storefront file is pinned by
 * `src/modules/course/__tests__/calendar-math.unit.spec.ts`.
 *
 * Timezone semantics: a term belongs to the calendar day its `starts_at`
 * falls on **in Europe/Prague** — the same day the owner sees in the Prague
 * date formatting next to it. Weekday arithmetic then runs on plain calendar
 * dates (year/month/day), which is timezone-free.
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

/* ------------------------------------------------------------------------- */
/* Bucketing                                                                 */
/* ------------------------------------------------------------------------- */

/** Anything with a `starts_at`, bucketed by its Prague day key. */
export const groupByPragueDay = <T extends { starts_at: string }>(
  items: T[]
): Map<string, T[]> => {
  const byDay = new Map<string, T[]>()
  for (const item of items) {
    const key = pragueDayKey(item.starts_at)
    const bucket = byDay.get(key)
    if (bucket) {
      bucket.push(item)
    } else {
      byDay.set(key, [item])
    }
  }
  return byDay
}
