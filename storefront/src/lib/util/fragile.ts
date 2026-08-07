import {
  cartHasCommissionCategory,
  deliveryAllowsCommission,
} from "./commission"

/**
 * Which deliveries may carry this basket, and why.
 *
 * Two different things end up asking the same question — *can this go by ordinary parcel?* —
 * and both answer no in the same way:
 *
 * - **Křehké**, declared by her per product. Handmade ceramics break, and nothing in the
 *   catalogue implies it: a heavy piece can travel fine and a light one can be a stem with a
 *   petal on top. So it is a flag she sets, not a number anything derives.
 * - **Zakázková výroba**, which was already restricted for the same physical reason.
 *
 * They share one rule — fragile carriage or collection in person — so they share one
 * implementation. What differs is only the sentence the customer reads, because being told
 * „your piece is fragile" when you ordered a commission is a non-sequitur.
 *
 * The customer cannot choose around it. That is the point: the alternative is a parcel that
 * arrives as pieces, and then everyone loses — she remakes it, they wait again.
 */

export type DeliveryRestriction = "fragile" | "commission" | null

type LineLike = {
  product?: {
    metadata?: Record<string, unknown> | null
    categories?: { handle?: string | null }[] | null
  } | null
}

export const isFragileLine = (item: LineLike) =>
  Boolean(item?.product?.metadata?.fragile)

export const cartHasFragile = (cart: { items?: LineLike[] | null } | null) =>
  (cart?.items ?? []).some(isFragileLine)

/**
 * The reason to show, when there is one.
 *
 * Fragile wins when both apply: it is the physical fact about the parcel, and a customer who
 * reads „this is fragile" understands the restriction immediately, whereas „this is a
 * commission" explains a rule by naming a category.
 */
export const deliveryRestrictionFor = (
  cart: { items?: LineLike[] | null } | null,
  hasCommissionProfile: boolean
): DeliveryRestriction => {
  if (cartHasFragile(cart)) return "fragile"
  if (cartHasCommissionCategory(cart) || hasCommissionProfile) return "commission"
  return null
}

/** Both restrictions permit exactly the same two deliveries. */
export const deliveryAllowedUnder = (
  option: { name?: string | null } | null | undefined,
  isPickup: boolean
) => deliveryAllowsCommission(option, isPickup)

export const restrictionNotice: Record<
  NonNullable<DeliveryRestriction>,
  string
> = {
  fragile:
    "Vybrali jste křehký kus. Kvůli bezpečné přepravě ho posíláme jen jako křehký balík Českou poštou — nebo si ho můžete vyzvednout osobně v ateliéru.",
  commission:
    "Zakázkovou výrobu posíláme jen jako křehký balík, nebo si ji můžete vyzvednout osobně v ateliéru.",
}

export const restrictionRowHint: Record<
  NonNullable<DeliveryRestriction>,
  string
> = {
  fragile: "Nedostupné pro křehké kusy",
  commission: "Nedostupné pro zakázkovou výrobu",
}
