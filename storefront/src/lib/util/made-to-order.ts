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

export type ProductionPaymentModeKind = "deposit" | "full" | "custom"

/**
 * The slider's bounds, as charge-now totals.
 *
 * `minimum` is the owner's floor — the deposit she needs to buy materials — and is never zero
 * and never "pay later". `maximum` is everything the basket allows to be paid today, which a
 * piece that forbids full prepayment can hold below the cart total. The backend computes and
 * re-clamps all three; the storefront only draws them.
 */
export type ProductionPaymentBounds = {
  minimum: number
  maximum: number
  amount: number
}

export type ProductionPaymentMode = {
  has_made_to_order: boolean
  can_pay_full: boolean
  mode: ProductionPaymentModeKind
  deposit_amount: number
  full_amount: number
  balance_later: number
  currency_code?: string
  custom: ProductionPaymentBounds | null
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

/** One photo the customer attached to a commission, as stored and as displayed. */
export type CommissionPhoto = {
  id?: string
  url: string
}

/** A photo on its way up. Lives here, not in the action file, so the picker can import it. */
export type CommissionUpload = {
  filename: string
  mime_type: string
  /** Base64, `data:` prefix included or not — the route copes with either. */
  data: string
}

/** An entry in the zakázka's diary, from either side of the conversation. */
export type CommissionNote = {
  id: string
  text?: string | null
  image_url?: string | null
  author: "customer" | "atelier"
  created_at: string
}

/** What the customer wrote and photographed, as it rides on the line item. */
export type CommissionBrief = {
  specification?: string
  note?: string
  photos?: string[]
}

/**
 * The line-item metadata shape the backend reads. Built here so no caller guesses it.
 *
 * `specification` is the answer to her question on the product page; `note` and `photos` are
 * the brief the customer writes at checkout. All three travel on the line item because Medusa
 * copies that metadata into the order — the cart is gone by the time anything reads it.
 */
export const madeToOrderMetadata = (
  specification: string,
  brief?: { note?: string; photos?: string[] }
) => ({
  made_to_order: {
    specification: specification.trim(),
    ...(brief?.note?.trim() ? { note: brief.note.trim() } : {}),
    ...(brief?.photos?.length ? { photos: brief.photos } : {}),
  },
})

/** Reads the brief back off a cart or order line, whatever shape it arrived in. */
export const readCommissionBrief = (item: {
  metadata?: Record<string, any> | null
}): CommissionBrief => {
  const raw = item?.metadata?.made_to_order
  if (!raw || typeof raw !== "object") return {}

  return {
    specification:
      typeof raw.specification === "string" ? raw.specification : undefined,
    note: typeof raw.note === "string" ? raw.note : undefined,
    photos: Array.isArray(raw.photos)
      ? raw.photos.filter((url: unknown): url is string => typeof url === "string")
      : undefined,
  }
}

/** "14–42 dní" / "do 42 dní" / "od 14 dní", whichever the profile can actually support. */
export const productionTimeLabel = (profile: ProductionProfile) => {
  const min = profile.production_time_min_days
  const max = profile.production_time_max_days

  if (min && max) return min === max ? `${max} dní` : `${min}–${max} dní`
  if (max) return `do ${max} dní`
  if (min) return `od ${min} dní`

  return null
}
