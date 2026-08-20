"use client"

import { useMemo, useRef, useState } from "react"

import type { CourseTerm } from "@lib/data/courses"
import {
  addMonths,
  buildMonthGrid,
  calendarMonthBounds,
  compareMonths,
  dayAriaLabel,
  groupTermsByDay,
  monthTitle,
  parseDayKey,
  pragueDayKey,
  CZECH_WEEKDAYS,
  type CalendarMonth,
} from "@lib/util/course-calendar"

/**
 * The Czech month calendar of step 1 — Monday-first, Prague semantics.
 *
 * Markup choice: a grid of plain buttons with full aria-labels and a roving
 * tabindex, not `role="grid"`. The ARIA grid pattern promises cell/row
 * semantics screen readers then expect everywhere; a set of buttons where
 * every day says „úterý 15. září — 1 termín, zbývají 3 místa" is the simpler
 * contract and degrades to nothing worse than Tab + Enter — which is what
 * this audience actually uses. Arrow keys still walk the whole month (roving
 * tabindex), so keyboard users get the two-dimensional movement without the
 * grid role's obligations.
 *
 * Days without terms stay rendered and focusable but `aria-disabled` — the
 * label says „žádný termín", clicking does nothing. Sold-out days stay fully
 * interactive: selecting them opens the waitlist story below the grid.
 */

type Props = {
  terms: CourseTerm[]
  selectedDay: string | null
  onSelectDay: (key: string) => void
}

export default function KurzyCalendar({ terms, selectedDay, onSelectDay }: Props) {
  const now = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => pragueDayKey(now.toISOString()), [now])
  const byDay = useMemo(() => groupTermsByDay(terms), [terms])
  const bounds = useMemo(() => calendarMonthBounds(terms, now), [terms, now])

  const initialMonth = useMemo<CalendarMonth>(() => {
    // Open on the month of the selected day, else the first month that has a
    // term, else the current one — an empty September with everything in
    // October would otherwise greet the customer with a blank grid.
    if (selectedDay) {
      const { year, month } = parseDayKey(selectedDay)
      return { year, month }
    }
    const dayKeys = Array.from(byDay.keys())
    let candidate = bounds.first
    while (
      compareMonths(candidate, bounds.last) < 0 &&
      !dayKeys.some((key) => key.startsWith(monthPrefix(candidate)))
    ) {
      candidate = addMonths(candidate, 1)
    }
    return candidate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [month, setMonth] = useState<CalendarMonth>(initialMonth)
  const weeks = useMemo(() => buildMonthGrid(month.year, month.month), [month])

  /* Roving tabindex: exactly one day is in the Tab order; arrows move it. */
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const monthDays = useMemo(
    () => weeks.flat().filter((cell): cell is { key: string; day: number } => !!cell),
    [weeks]
  )
  const tabStop =
    (focusedKey && monthDays.some((cell) => cell.key === focusedKey)
      ? focusedKey
      : null) ??
    (selectedDay && monthDays.some((cell) => cell.key === selectedDay)
      ? selectedDay
      : null) ??
    monthDays.find((cell) => byDay.has(cell.key))?.key ??
    monthDays[0]?.key ??
    null

  const canGoPrev = compareMonths(month, bounds.first) > 0
  const canGoNext = compareMonths(month, bounds.last) < 0

  const goMonth = (delta: number) => {
    setMonth((current) => {
      const next = addMonths(current, delta)
      if (
        compareMonths(next, bounds.first) < 0 ||
        compareMonths(next, bounds.last) > 0
      ) {
        return current
      }
      setFocusedKey(null)
      return next
    })
  }

  const focusDay = (key: string) => {
    setFocusedKey(key)
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${key}"]`)
        ?.focus()
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const current = tabStop
    if (!current) return
    const index = monthDays.findIndex((cell) => cell.key === current)
    if (index < 0) return

    const move = (delta: number) => {
      event.preventDefault()
      const next = index + delta
      if (next >= 0 && next < monthDays.length) {
        focusDay(monthDays[next].key)
      } else if (next < 0 && canGoPrev) {
        goMonth(-1)
      } else if (next >= monthDays.length && canGoNext) {
        goMonth(1)
      }
    }

    switch (event.key) {
      case "ArrowRight":
        move(1)
        break
      case "ArrowLeft":
        move(-1)
        break
      case "ArrowDown":
        move(7)
        break
      case "ArrowUp":
        move(-7)
        break
      case "Home":
        event.preventDefault()
        focusDay(monthDays[0].key)
        break
      case "End":
        event.preventDefault()
        focusDay(monthDays[monthDays.length - 1].key)
        break
      default:
        break
    }
  }

  return (
    <div className="kurzyCalendar">
      <div className="kurzyCalendar__head">
        <button
          type="button"
          className="kurzyCalendar__nav"
          onClick={() => goMonth(-1)}
          disabled={!canGoPrev}
          aria-label="Předchozí měsíc"
        >
          ‹
        </button>
        <strong aria-live="polite">{monthTitle(month)}</strong>
        <button
          type="button"
          className="kurzyCalendar__nav"
          onClick={() => goMonth(1)}
          disabled={!canGoNext}
          aria-label="Další měsíc"
        >
          ›
        </button>
      </div>

      <div className="kurzyCalendar__weekdays" aria-hidden="true">
        {CZECH_WEEKDAYS.map((weekday) => (
          <span key={weekday.short}>{weekday.short}</span>
        ))}
      </div>

      <div
        ref={gridRef}
        className="kurzyCalendar__grid"
        role="group"
        aria-label={`Kalendář termínů — ${monthTitle(month)}`}
        onKeyDown={handleKeyDown}
      >
        {weeks.flat().map((cell, index) => {
          if (!cell) {
            return <span key={`pad-${index}`} className="kurzyCalendar__pad" />
          }
          const dayTerms = byDay.get(cell.key) ?? []
          const hasTerms = dayTerms.length > 0
          const allSoldOut = hasTerms && dayTerms.every((term) => term.sold_out)
          const isToday = cell.key === todayKey
          const isSelected = cell.key === selectedDay
          return (
            <button
              key={cell.key}
              type="button"
              data-day={cell.key}
              className={`kurzyCalendar__day${hasTerms ? " has-terms" : ""}${
                allSoldOut ? " is-full" : ""
              }${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
              tabIndex={cell.key === tabStop ? 0 : -1}
              aria-disabled={!hasTerms || undefined}
              aria-pressed={hasTerms ? isSelected : undefined}
              aria-label={dayAriaLabel(cell.key, dayTerms)}
              onFocus={() => setFocusedKey(cell.key)}
              onClick={() => {
                if (hasTerms) {
                  onSelectDay(cell.key)
                }
              }}
            >
              <span aria-hidden="true">{cell.day}</span>
              {hasTerms ? (
                <i
                  className="kurzyCalendar__dot"
                  aria-hidden="true"
                  data-count={dayTerms.length > 1 ? dayTerms.length : undefined}
                />
              ) : null}
            </button>
          )
        })}
      </div>

      <p className="kurzyCalendar__legend">
        <i aria-hidden="true" /> den s vypsaným termínem — vyberte ho a termín
        se ukáže pod kalendářem
      </p>
    </div>
  )
}

const monthPrefix = (month: CalendarMonth): string =>
  `${month.year}-${String(month.month).padStart(2, "0")}`
