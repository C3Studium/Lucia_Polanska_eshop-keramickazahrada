/**
 * Weekly recurrence for course terms — pure, dependency-free, unit-tested.
 *
 * The rule the owner sees: „opakovat každý týden" means the same weekday at
 * the same **Prague wall-clock time**. A 17:00 course stays a 17:00 course in
 * November, even though the March/October DST changes shift Prague between
 * UTC+1 and UTC+2.
 *
 * ## The DST mechanism
 *
 * Stepping +7×24 hours on the UTC instant would drift the wall-clock hour by
 * one across each DST boundary (a 16:00Z summer start would become 17:00
 * Prague in winter). So occurrences are computed the other way around:
 *
 * 1. Decompose `starts_at` into its **Prague wall-clock components**
 *    (year/month/day + hour/minute/second) via `Intl.DateTimeFormat` with
 *    `timeZone: "Europe/Prague"` — the only timezone database we need is the
 *    runtime's own.
 * 2. Step the plain calendar date +7 days with timezone-free date arithmetic
 *    (weekday is a property of the calendar date, so it is preserved exactly).
 * 3. Re-anchor each wall-clock date+time back to a UTC instant with the
 *    classic two-pass offset probe (`utcFromPragueWallClock`): guess the
 *    instant as if the wall clock were UTC, measure Prague's real offset at
 *    that guess, correct, and re-measure once — two passes converge for every
 *    wall time that exists. (Only the skipped 02:00–03:00 hour of the spring
 *    changeover has no exact instant; courses at such an hour resolve to the
 *    adjacent real instant. A 17:00 course never gets close.)
 *
 * The admin drawer imports these same functions for its live preview and the
 * terms route runs them again server-side — one implementation, so the
 * preview and the created rows can never disagree.
 */

/** Hard ceiling on how many terms one request may create. */
export const MAX_OCCURRENCES = 60

export type PragueWallClock = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export type PlainDate = { year: number; month: number; day: number }

const pad2 = (value: number): string => String(value).padStart(2, "0")

const wallClockFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

/** The Prague wall-clock reading of a UTC instant. */
export const pragueWallClockOf = (instant: Date): PragueWallClock => {
  const parts: Record<string, number> = {}
  for (const part of wallClockFormat.formatToParts(instant)) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value)
    }
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    // h23 still reports midnight as 24 in some ICU versions.
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

/** Prague's UTC offset (ms) at a given instant — +1h in winter, +2h in summer. */
const pragueOffsetMs = (instant: Date): number => {
  const wall = pragueWallClockOf(instant)
  const asIfUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second
  )
  return asIfUtc - instant.getTime()
}

/**
 * The UTC instant at which Prague's clocks show the given wall time.
 * Two-pass offset probe — see the module header for why this is exact for
 * every wall time that actually exists.
 */
export const utcFromPragueWallClock = (wall: PragueWallClock): Date => {
  const asIfUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second
  )
  const firstGuess = asIfUtc - pragueOffsetMs(new Date(asIfUtc))
  return new Date(asIfUtc - pragueOffsetMs(new Date(firstGuess)))
}

export const dayKeyOfDate = (date: PlainDate): string =>
  `${date.year}-${pad2(date.month)}-${pad2(date.day)}`

/** Timezone-free calendar-date arithmetic (UTC normalizes overflow). */
export const addDays = (date: PlainDate, delta: number): PlainDate => {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + delta)
  )
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate()

/** Monday-first weekday index (0 = pondělí … 6 = neděle) of a plain date. */
export const mondayIndexOf = (date: PlainDate): number =>
  (new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7

/**
 * „každé úterý" — the weekday with the grammatically matching form of
 * „každý": pondělí/úterý are neuter, středa/sobota/neděle feminine,
 * čtvrtek/pátek masculine. Monday-first, matching `mondayIndexOf`.
 */
export const CZECH_WEEKLY_PHRASES = [
  "každé pondělí",
  "každé úterý",
  "každou středu",
  "každý čtvrtek",
  "každý pátek",
  "každou sobotu",
  "každou neděli",
] as const

/* ------------------------------------------------------------------------- */
/* Horizons                                                                  */
/* ------------------------------------------------------------------------- */

/** The fixed horizon choices the drawer offers (custom end is separate). */
export type RepeatHorizon = "tento_mesic" | "ctvrt_roku" | "pul_roku" | "rok"

const HORIZON_MONTHS: Record<Exclude<RepeatHorizon, "tento_mesic">, number> = {
  ctvrt_roku: 3,
  pul_roku: 6,
  rok: 12,
}

/**
 * The inclusive last Prague calendar day of a horizon, as a "YYYY-MM-DD" key.
 *
 * - „tento měsíc" ends with the last day of starts_at's own Prague month.
 * - +3/+6/+12 months land on the same day-of-month, clamped to the target
 *   month's length (Jan 31 + 3 months → Apr 30 — no silent spill into May).
 */
export const horizonEndDayKey = (
  startsAtIso: string,
  horizon: RepeatHorizon
): string => {
  const wall = pragueWallClockOf(new Date(startsAtIso))
  if (horizon === "tento_mesic") {
    return dayKeyOfDate({
      year: wall.year,
      month: wall.month,
      day: daysInMonth(wall.year, wall.month),
    })
  }
  const monthIndex = wall.month - 1 + HORIZON_MONTHS[horizon]
  const year = wall.year + Math.floor(monthIndex / 12)
  const month = (monthIndex % 12) + 1
  return dayKeyOfDate({
    year,
    month,
    day: Math.min(wall.day, daysInMonth(year, month)),
  })
}

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Accepts either a plain "YYYY-MM-DD" (already a Prague calendar day — what
 * the drawer's date input produces) or a full ISO instant (bucketed into its
 * Prague day). Returns null for anything else — including impossible dates
 * like Feb 30.
 */
export const normalizeUntilDayKey = (until: string): string | null => {
  if (DAY_KEY_PATTERN.test(until)) {
    const [year, month, day] = until.split("-").map(Number)
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
      return null
    }
    return until
  }
  const parsed = new Date(until)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  const wall = pragueWallClockOf(parsed)
  return dayKeyOfDate({ year: wall.year, month: wall.month, day: wall.day })
}

/* ------------------------------------------------------------------------- */
/* Occurrence plan                                                           */
/* ------------------------------------------------------------------------- */

/**
 * Both members carry the other's fields as optional-undefined so callers can
 * read `plan.reason` / `plan.occurrences` after checking `ok` — the backend
 * compiles without `strictNullChecks`, where truthiness narrowing of a
 * boolean discriminant does not stick.
 */
export type OccurrencePlan =
  | {
      ok: true
      /** UTC ISO instants, first one re-derived from starts_at's wall clock. */
      occurrences: string[]
      /** True when the horizon held more than `cap` weeks and was cut short. */
      truncated: boolean
      reason?: undefined
    }
  | {
      ok: false
      reason: "until_before_start" | "invalid_start"
      occurrences?: undefined
      truncated?: undefined
    }

/**
 * Every weekly occurrence from `starts_at` through `untilDayKey` (inclusive —
 * an occurrence landing exactly on the end day is created), capped at `cap`.
 *
 * Both the drawer preview and the server run exactly this function; the
 * server never trusts client-side counts.
 */
export const planWeeklyOccurrences = (
  startsAtIso: string,
  untilDayKey: string,
  cap: number = MAX_OCCURRENCES
): OccurrencePlan => {
  const start = new Date(startsAtIso)
  if (Number.isNaN(start.getTime())) {
    return { ok: false, reason: "invalid_start" }
  }
  const wall = pragueWallClockOf(start)
  let date: PlainDate = { year: wall.year, month: wall.month, day: wall.day }
  if (untilDayKey < dayKeyOfDate(date)) {
    // Zero-padded keys compare correctly as strings.
    return { ok: false, reason: "until_before_start" }
  }
  const occurrences: string[] = []
  let truncated = false
  while (dayKeyOfDate(date) <= untilDayKey) {
    if (occurrences.length >= cap) {
      truncated = true
      break
    }
    occurrences.push(
      utcFromPragueWallClock({
        year: date.year,
        month: date.month,
        day: date.day,
        hour: wall.hour,
        minute: wall.minute,
        second: wall.second,
      }).toISOString()
    )
    date = addDays(date, 7)
  }
  return { ok: true, occurrences, truncated }
}

/* ------------------------------------------------------------------------- */
/* Multi-day plan                                                            */
/* ------------------------------------------------------------------------- */

/**
 * The owner clicks the days in a calendar rather than typing one date.
 *
 * Several picked days and „opakovat každý týden" compose: each picked day is a
 * seed, and each seed grows its own weekly series through the horizon. Picking
 * 3., 11. and 16. October with repeat-until-31 gives 3/10/17/24/31 + 11/18/25 +
 * 16/23/30 — the union, deduplicated, in time order.
 *
 * Deduplication matters because two seeds can collide (pick a Monday and the
 * Monday after it, repeat weekly, and both series cover the same later dates).
 * The owner picked days, not rows; two clicks that mean the same session must
 * not create two terms.
 *
 * A picked day later than the horizon still creates its own term — the click
 * was explicit, and silently dropping it would be the surprising reading of
 * „vytvoř tyhle dny".
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export type TimeOfDay = { hour: number; minute: number }

/** "HH:MM" (24h) → components, or null when it is not a real wall time. */
export const parseTimeOfDay = (time: string): TimeOfDay | null => {
  const match = TIME_PATTERN.exec(String(time ?? "").trim())
  if (!match) {
    return null
  }
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

/** A "YYYY-MM-DD" that names a real calendar day. */
export const isValidDayKey = (key: string): boolean => {
  if (!DAY_KEY_PATTERN.test(String(key ?? ""))) {
    return false
  }
  const [year, month, day] = key.split("-").map(Number)
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

export type MultiDayPlan =
  | {
      ok: true
      /** UTC ISO instants, deduplicated and ascending. */
      occurrences: string[]
      /** True when the union exceeded `cap` and was cut short. */
      truncated: boolean
      reason?: undefined
    }
  | {
      ok: false
      reason: "no_days" | "invalid_time" | "invalid_day"
      occurrences?: undefined
      truncated?: undefined
    }

export const planMultiDayOccurrences = (
  dayKeys: string[],
  time: string,
  untilDayKey: string | null,
  cap: number = MAX_OCCURRENCES
): MultiDayPlan => {
  const clock = parseTimeOfDay(time)
  if (!clock) {
    return { ok: false, reason: "invalid_time" }
  }

  const days = Array.from(new Set(dayKeys ?? []))
  if (!days.length) {
    return { ok: false, reason: "no_days" }
  }
  if (days.some((key) => !isValidDayKey(key))) {
    return { ok: false, reason: "invalid_day" }
  }

  const instants = new Set<string>()
  for (const key of days.slice().sort()) {
    let date: PlainDate = parseDayKeyToPlain(key)
    for (;;) {
      instants.add(
        utcFromPragueWallClock({
          year: date.year,
          month: date.month,
          day: date.day,
          hour: clock.hour,
          minute: clock.minute,
          second: 0,
        }).toISOString()
      )
      if (!untilDayKey) {
        break
      }
      const next = addDays(date, 7)
      if (dayKeyOfDate(next) > untilDayKey) {
        break
      }
      date = next
      // The cap is enforced on the union below; a single runaway series still
      // has to stop somewhere, and no horizon holds more than cap weeks.
      if (instants.size > cap * 4) {
        break
      }
    }
  }

  const occurrences = Array.from(instants).sort()
  if (occurrences.length > cap) {
    return { ok: true, occurrences: occurrences.slice(0, cap), truncated: true }
  }
  return { ok: true, occurrences, truncated: false }
}

const parseDayKeyToPlain = (key: string): PlainDate => {
  const [year, month, day] = key.split("-").map(Number)
  return { year, month, day }
}
