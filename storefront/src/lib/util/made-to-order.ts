/**
 * Made-to-order: the contract shared by the product page, checkout and express checkout.
 *
 * Types and pure helpers only, so client components can import them. The fetchers live in
 * `@lib/data/made-to-order`, which reaches for server-only cookies.
 */

export type ProductionVariantRule = {
  variant_id: string
  deposit_percentage_override?: number | null
}

export type ProductionProfile = {
  enabled: boolean
  specification_required: boolean
  specification_prompt?: string | null
  production_time_min_days?: number | null
  production_time_max_days?: number | null
  default_deposit_percentage?: number | null
  allow_full_prepayment?: boolean | null
  variants?: ProductionVariantRule[] | null
}

export type ProductionPaymentMode = {
  has_made_to_order: boolean
  can_pay_full: boolean
  mode: "deposit" | "full"
  deposit_amount: number
  full_amount: number
  balance_later: number
  currency_code?: string
}

/** The deposit that applies to a variant: its override beats the product default. */
export const depositPercentageFor = (
  profile: ProductionProfile | null | undefined,
  variantId?: string | null
) => {
  if (!profile) return null

  const override = profile.variants?.find(
    (rule) => rule.variant_id === variantId
  )?.deposit_percentage_override

  return override ?? profile.default_deposit_percentage ?? null
}

/** The line-item metadata shape the backend reads. Built here so no caller guesses it. */
export const madeToOrderMetadata = (specification: string) => ({
  made_to_order: { specification: specification.trim() },
})

/** "14–42 dní" / "do 42 dní" / "od 14 dní", whichever the profile can actually support. */
export const productionTimeLabel = (profile: ProductionProfile) => {
  const min = profile.production_time_min_days
  const max = profile.production_time_max_days

  if (min && max) return min === max ? `${max} dní` : `${min}–${max} dní`
  if (max) return `do ${max} dní`
  if (min) return `od ${min} dní`

  return null
}
