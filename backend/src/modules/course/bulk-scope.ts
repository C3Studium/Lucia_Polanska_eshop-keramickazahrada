/**
 * „Kde se to má projevit?" — the scope a bulk edit applies to.
 *
 * The owner edits a price or a note on one term, and then has to say how far
 * it reaches: this term only, the terms she picked in the calendar, everything
 * still ahead, or a stretch of dates. Before this, the answer was always „this
 * one" and raising the autumn price meant opening fourteen terms in a row.
 *
 * Pure and dependency-free so the rules below — which are the whole point —
 * are provable without a database, and so the admin can show an honest count
 * („změní 14 termínů") using the very same function the server will run.
 *
 * ## Two rules that are not negotiable
 *
 * - **A cancelled term is never touched.** It is a historical record; its
 *   price and note are what its customers were told at the time.
 * - **The past is never touched by a blanket scope.** „Všechny nadcházející"
 *   means what it says. A finished term keeps the price it was sold at, so
 *   the money in the reservations still matches the term they point to.
 *   An explicit id list is the one way to reach a past term, because there
 *   the owner named it.
 */

import { pragueWallClockOf, dayKeyOfDate } from "./recurrence"

export type BulkScope =
  /** Exactly these terms — what the calendar's own selection produces. */
  | { kind: "terms"; ids: string[] }
  /** Every term that has not started yet. */
  | { kind: "all_upcoming" }
  /** Every upcoming term whose Prague day falls in [from, to], inclusive. */
  | { kind: "period"; from: string; to: string }

export type ScopeCandidate = {
  id: string
  starts_at: string | Date
  status: string
}

/** The Prague calendar day an instant belongs to, as "YYYY-MM-DD". */
const dayKeyOf = (value: string | Date): string => {
  const wall = pragueWallClockOf(new Date(value))
  return dayKeyOfDate({ year: wall.year, month: wall.month, day: wall.day })
}

/**
 * The terms a scope actually reaches.
 *
 * `now` is injected rather than read from the clock so the boundary — a term
 * starting in one minute is still "upcoming" — is testable.
 */
export const resolveScopeTermIds = (
  terms: ScopeCandidate[],
  scope: BulkScope,
  now: Date = new Date()
): string[] => {
  const live = (terms ?? []).filter((term) => term?.status !== "cancelled")

  if (scope.kind === "terms") {
    const wanted = new Set(scope.ids ?? [])
    return live.filter((term) => wanted.has(term.id)).map((term) => term.id)
  }

  const upcoming = live.filter(
    (term) => new Date(term.starts_at).getTime() >= now.getTime()
  )

  if (scope.kind === "all_upcoming") {
    return upcoming.map((term) => term.id)
  }

  // Zero-padded day keys compare correctly as strings, and a reversed range is
  // read as the range the owner meant rather than as an empty one.
  const from = scope.from <= scope.to ? scope.from : scope.to
  const to = scope.from <= scope.to ? scope.to : scope.from
  return upcoming
    .filter((term) => {
      const key = dayKeyOf(term.starts_at)
      return key >= from && key <= to
    })
    .map((term) => term.id)
}
