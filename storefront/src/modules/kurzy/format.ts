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

/**
 * Cenový žebříček termínu — „kolik to stojí", než si někdo vybere den.
 *
 * Ceny byly na kartě termínu, tedy až za kliknutím na den v kalendáři.
 * Kdo se ptá „kolik to stojí", se to tak dozvěděl až napotřetí. Tenhle
 * žebříček se říká na kroku 1 nad kalendářem a znovu na kroku 2 u počtu
 * osob, kde odpovídá na druhou otázku: vyplatí se přibrat někoho dalšího?
 */
export type PriceTier = {
  key: CourseQuote["tier"]
  /** „Jeden člověk", „Dva lidé", „Od 3 lidí" — co je potřeba splnit. */
  label: string
  perPerson: number
}

type TermPricing = {
  price_single: number
  price_two: number | null
  group_min: number | null
  price_group_per_person: number | null
}

export const priceTiers = (term: TermPricing): PriceTier[] => {
  const tiers: PriceTier[] = [
    { key: "single", label: "Jeden člověk", perPerson: term.price_single },
  ]
  /* Slabší hladina se nevypisuje: „za dva 500" vedle „za jednoho 500" není
     nabídka, je to šum. Totéž u skupiny. */
  if (term.price_two != null && term.price_two < term.price_single) {
    tiers.push({ key: "pair", label: "Dva lidé", perPerson: term.price_two })
  }
  if (
    term.group_min != null &&
    term.price_group_per_person != null &&
    term.price_group_per_person < (tiers[tiers.length - 1]?.perPerson ?? Infinity)
  ) {
    tiers.push({
      key: "group",
      label: `Od ${term.group_min} lidí`,
      perPerson: term.price_group_per_person,
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
