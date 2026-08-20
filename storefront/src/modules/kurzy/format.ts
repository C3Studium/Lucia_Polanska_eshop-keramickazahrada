import type { CourseQuote } from "@lib/data/courses"

/**
 * The kurzy surface's shared formatting voice — one place for the Prague
 * date, the money and the Czech plurals the reservation modal, the teaser
 * and the detail page all speak.
 */

export const formatPrague = (value: string): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))

/** Time of day alone — the calendar day card already names the day. */
export const formatPragueTime = (value: string): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))

export const formatDuration = (minutes: number | null): string => {
  if (!minutes) return ""
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} minut`
  const label = hours === 1 ? "hodina" : hours < 5 ? "hodiny" : "hodin"
  return rest ? `${hours} ${label} ${rest} min` : `${hours} ${label}`
}

export const czk = (value: number): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)

export const seatsLabel = (left: number): string =>
  left === 1
    ? "poslední místo"
    : left < 5
      ? `${left} volná místa`
      : `${left} volných míst`

export const peopleLabel = (count: number): string =>
  count === 1 ? "1 osobu" : count < 5 ? `${count} osoby` : `${count} osob`

export const TIER_LABEL: Record<CourseQuote["tier"], string> = {
  single: "cena za jednoho",
  pair: "cena za dva",
  group: "skupinová cena",
}
