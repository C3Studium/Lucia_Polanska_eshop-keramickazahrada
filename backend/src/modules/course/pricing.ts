/**
 * The course price and capacity arithmetic, in one dependency-free place.
 *
 * Everything that decides what a reservation costs or whether it fits goes
 * through these functions: the store quote endpoint, the reservation create
 * (inside the row lock), and the admin manual entry. The storefront only ever
 * *displays* what the server computed — it never does this math itself.
 *
 * The tier rules, as the owner described them:
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
}

export type CourseQuote = {
  tier: PricingTier
  /** CZK per person for the resolved tier. */
  per_person: number
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

/** A usable pair price exists — positive, not merely a null column. */
export const hasPairPricing = (rules: CoursePricingRules): boolean =>
  toAmount(rules.price_two) > 0

/** Usable group pricing exists: a threshold of at least 2 and a positive rate. */
export const hasGroupPricing = (rules: CoursePricingRules): boolean => {
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

export const quoteFor = (
  partySize: number,
  rules: CoursePricingRules
): CourseQuote => {
  if (!Number.isInteger(partySize) || partySize < 1) {
    throw new Error("Party size must be a whole number of at least 1")
  }

  const tier = pricingTierFor(partySize, rules)
  const perPerson =
    tier === "pair"
      ? toAmount(rules.price_two)
      : tier === "group"
        ? toAmount(rules.price_group_per_person)
        : toAmount(rules.price_single)

  return {
    tier,
    per_person: round2(perPerson),
    total: round2(perPerson * partySize),
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
