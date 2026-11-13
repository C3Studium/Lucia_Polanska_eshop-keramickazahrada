/**
 * The course price and capacity arithmetic, in one dependency-free place.
 *
 * Everything that decides what a reservation costs or whether it fits goes
 * through these functions: the store quote endpoint, the reservation create
 * (inside the row lock), and the admin manual entry. The storefront only ever
 * *displays* what the server computed — it never does this math itself.
 *
 * Od 13. 11. 2026 platí jen dvě ceny: dospělý (`price_single`) a dítě do
 * `child_max_age` let (`price_child`), obě za osobu. Množstevní slevy (za
 * dva, za skupinu) jsou zrušené — `volumePricingOn` vrací vždy NE, takže
 * `quoteFor` dává pokaždé `single`. Sloupce `price_two`, `group_min`,
 * `price_group_per_person` a `volume_pricing_enabled` zůstávají v databázi
 * kvůli starým rezervacím (jejich uložený `pricing_tier`), jen se nepoužijí.
 *
 * Původní pásma, jak je majitelka popsala (dnes vypnutá):
 *
 * - 1 person → `single`, pays `price_single`.
 * - 2 people together → `pair`, pays `price_two` **per person** — when the
 *   term has a pair price. The pair price is the more specific rule, so it
 *   wins even if a group rate technically starts at 2.
 * - `group_min` or more people → `group`, pays `price_group_per_person`
 *   per person — when the term has group pricing.
 * - Anything else (3 people below the group threshold, 2 without a pair
 *   price…) simply pays `price_single` × people.
 */

export type PricingTier = "single" | "pair" | "group"

export type CoursePricingRules = {
  price_single: unknown
  price_two?: unknown
  group_min?: unknown
  price_group_per_person?: unknown
  /**
   * Vypínač množstevní slevy (8. 11. 2026). Vypnuté = platí se za osobu, ať
   * přijde kdokoli; ceny za dva a za skupinu zůstanou uložené, jen se
   * nepoužijí. Nevyplněné znamená ZAPNUTO, aby starý termín nezlevnil ani
   * nezdražil tím, že přibyl sloupec.
   */
  volume_pricing_enabled?: unknown
  /** Cena za dítě (za osobu), a do kolika let se za dítě počítá. */
  price_child?: unknown
  child_max_age?: unknown
}

export type CourseQuote = {
  tier: PricingTier
  /** CZK per person for the resolved tier — cena DOSPĚLÉHO. */
  per_person: number
  /** CZK za dítě. Bez dětské ceny je to totéž co `per_person`. */
  child_per_person: number
  /** Kolik z party se počítá jako děti (0 až počet osob). */
  children: number
  /** CZK for the whole party — what the reservation stores. */
  total: number
}

/**
 * Numeric columns arrive as numbers, strings or big-number objects depending
 * on who loaded them — the same reality `lib/balance-payment.ts` handles.
 */
export const toAmount = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return toAmount(candidate.value ?? candidate.numeric_ ?? candidate.raw_ ?? 0)
  }
  return 0
}

const round2 = (value: number): number => Math.round(value * 100) / 100

/**
 * Je množstevní sleva zapnutá? Vždy NE.
 *
 * „Skupinová cena není, jen jeden člověk nebo dítě do 15 let." (Matěj,
 * 13. 11. 2026.) Přepínač termínu (`volume_pricing_enabled`) se proto
 * ignoruje — i termín, který ho má zapnutý a ceny za dva a za skupinu
 * vyplněné, se počítá za osobu. Kdyby se sleva někdy vracela, tady je to
 * jediné místo: store API, výpočet ceny i změna počtu osob jdou přes tuhle
 * funkci.
 */
export const volumePricingOn = (_rules: CoursePricingRules): boolean => false

/** Dětská cena je vyplněná a kladná. */
export const hasChildPricing = (rules: CoursePricingRules): boolean =>
  toAmount(rules.price_child) > 0

/** Do kolika let se platí dětská cena. Nevyplněné = 15 (přání majitelky). */
export const childMaxAge = (rules: CoursePricingRules): number => {
  const vek = Math.trunc(toAmount(rules.child_max_age))
  return vek > 0 ? vek : 15
}

/** A usable pair price exists — positive, not merely a null column. */
export const hasPairPricing = (rules: CoursePricingRules): boolean =>
  volumePricingOn(rules) && toAmount(rules.price_two) > 0

/** Usable group pricing exists: a threshold of at least 2 and a positive rate. */
export const hasGroupPricing = (rules: CoursePricingRules): boolean => {
  if (!volumePricingOn(rules)) return false
  const min = toAmount(rules.group_min)
  return min >= 2 && toAmount(rules.price_group_per_person) > 0
}

export const pricingTierFor = (
  partySize: number,
  rules: CoursePricingRules
): PricingTier => {
  if (partySize === 2 && hasPairPricing(rules)) {
    return "pair"
  }
  if (hasGroupPricing(rules) && partySize >= toAmount(rules.group_min)) {
    return "group"
  }
  return "single"
}

/**
 * Kdo přišel. Číslo je zkratka pro „samí dospělí" — tak to volá většina
 * míst a nemusí se kvůli dětem přepisovat.
 */
export type CourseParty = number | { people: number; children?: number }

export const quoteFor = (
  party: CourseParty,
  rules: CoursePricingRules
): CourseQuote => {
  const partySize =
    typeof party === "number" ? party : Math.trunc(toAmount(party.people))

  if (!Number.isInteger(partySize) || partySize < 1) {
    throw new Error("Party size must be a whole number of at least 1")
  }

  /*
   * Dětí nemůže být víc než lidí a nemůže jich být záporně. Ořezat je tady
   * je bezpečnější než věřit volajícímu: tenhle výpočet rozhoduje o tom, co
   * se zákazníkovi strhne.
   */
  const deti =
    typeof party === "number"
      ? 0
      : Math.min(Math.max(0, Math.trunc(toAmount(party.children))), partySize)

  /*
   * Pásmo se počítá z CELÉ party, dítě nevyjímaje: na kurz přišli tři lidé,
   * ať je mezi nimi dítě nebo ne. Dětská sleva se pak uplatní na jejich
   * místa zvlášť — jsou to dvě různé slevy a nemají si brát jedna druhé.
   */
  const tier = pricingTierFor(partySize, rules)
  const perPerson =
    tier === "pair"
      ? toAmount(rules.price_two)
      : tier === "group"
        ? toAmount(rules.price_group_per_person)
        : toAmount(rules.price_single)

  /* Bez vyplněné dětské ceny platí dítě jako dospělý — nic se nevymýšlí. */
  const perChild = hasChildPricing(rules)
    ? toAmount(rules.price_child)
    : perPerson

  return {
    tier,
    per_person: round2(perPerson),
    child_per_person: round2(perChild),
    children: deti,
    total: round2(perPerson * (partySize - deti) + perChild * deti),
  }
}

/* ------------------------------------------------------------------------- */
/* Capacity                                                                  */
/* ------------------------------------------------------------------------- */

export type ReservationSeats = {
  party_size: unknown
  /** `cancelled` rows do not occupy seats; anything else does. */
  status?: string | null
}

/** Seats occupied by non-cancelled reservations. */
export const seatsTaken = (reservations: ReservationSeats[]): number =>
  reservations.reduce((sum, reservation) => {
    if (reservation?.status === "cancelled") {
      return sum
    }
    const size = Math.trunc(toAmount(reservation?.party_size))
    return sum + Math.max(0, size)
  }, 0)

export const seatsLeft = (
  capacity: unknown,
  reservations: ReservationSeats[]
): number => Math.max(0, Math.trunc(toAmount(capacity)) - seatsTaken(reservations))

/** Whether a party of `partySize` still fits. The create re-checks this inside a row lock. */
export const fitsCapacity = (
  capacity: unknown,
  alreadyTaken: number,
  partySize: number
): boolean => alreadyTaken + partySize <= Math.trunc(toAmount(capacity))
