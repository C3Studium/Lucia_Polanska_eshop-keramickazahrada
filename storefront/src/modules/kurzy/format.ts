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
  single: "cena za osobu",
  /* Staré rezervace z doby množstevních slev (do 13. 11. 2026). */
  pair: "cena za dva",
  group: "skupinová cena",
}

/**
 * Cenový žebříček termínu — „kolik to stojí", než si někdo vybere den.
 *
 * Od 13. 11. 2026 jen dvě ceny (Matěj: „skupinová cena není, jen jeden
 * člověk nebo dítě do 15 let"): dospělý a dítě. Ceny za dva a za skupinu
 * se nevypisují, i kdyby je termín v databázi ještě měl — backend je
 * stejně nepočítá (`modules/course/pricing.ts`).
 */
export type PriceTier = {
  key: "single" | "child"
  /** „Dospělý", „Dítě do 15 let". */
  label: string
  perPerson: number
}

type TermPricing = {
  price_single: number
  price_child?: number | null
  child_max_age?: number | null
}

export const priceTiers = (term: TermPricing): PriceTier[] => {
  const tiers: PriceTier[] = [
    { key: "single", label: "Dospělý", perPerson: term.price_single },
  ]
  if (term.price_child != null && term.price_child > 0) {
    tiers.push({
      key: "child",
      label: `Dítě do ${term.child_max_age ?? 15} let`,
      perPerson: term.price_child,
    })
  }
  return tiers
}

/** Mají všechny termíny tentýž žebříček? Když ne, patří cena jen na karty. */
export const sharedPriceTiers = (terms: TermPricing[]): PriceTier[] | null => {
  if (terms.length === 0) return null
  const first = priceTiers(terms[0])
  const otisk = (tiers: PriceTier[]) =>
    tiers.map((tier) => `${tier.key}:${tier.label}:${tier.perPerson}`).join("|")
  const vzor = otisk(first)
  return terms.every((term) => otisk(priceTiers(term)) === vzor) ? first : null
}
