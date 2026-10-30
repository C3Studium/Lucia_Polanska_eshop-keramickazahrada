import {
  cartHasCommissionCategory,
  deliveryAllowsCommission,
} from "./commission"
import { cartIsVoucherOnly } from "./gift-voucher-cart"

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

/**
 * Třetí důvod přibyl 30. 10. 2026: **dárkový poukaz**. Košík, ve kterém není
 * nic než poukazy, se neposílá dopravcem — elektronický chodí e-mailem (to je
 * položka bez dopravy a krok Doručení se přeskočí úplně, viz
 * `lib/util/needs-shipping.ts`) a vytištěný se předává v dílně. Posílat
 * kartičku za 500 Kč křehkým balíkem nedává smysl ani jí, ani zákazníkovi.
 */
export type DeliveryRestriction = "fragile" | "commission" | "voucher" | null

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
  /* Poukaz vyhrává: v takovém košíku žádný křehký kus ani zakázka není, a kdyby
     byl, nebyl by to košík jen s poukazy. */
  if (cartIsVoucherOnly(cart as never)) return "voucher"
  if (cartHasFragile(cart)) return "fragile"
  if (cartHasCommissionCategory(cart) || hasCommissionProfile) return "commission"
  return null
}

/**
 * Co smí takový košík odvézt. Křehké i zakázka dovolí totéž (křehký balík
 * nebo osobní odběr); u poukazu zbývá jen osobní odběr — posílat ho dopravcem
 * se nenabízí vůbec.
 */
export const deliveryAllowedUnder = (
  option: { name?: string | null } | null | undefined,
  isPickup: boolean,
  restriction: DeliveryRestriction = null
) =>
  restriction === "voucher" ? isPickup : deliveryAllowsCommission(option, isPickup)

export const restrictionNotice: Record<
  NonNullable<DeliveryRestriction>,
  string
> = {
  fragile:
    "Vybrali jste křehký kus. Aby dorazil v pořádku, posíláme ho jen jako křehký balík Českou poštou — nebo si pro něj můžete přijet do ateliéru.",
  commission:
    "Zakázkovou výrobu posíláme jen jako křehký balík. Nebo si pro ni můžete přijet do ateliéru.",
  voucher:
    "V košíku máte jen dárkový poukaz. Vytištěný si ho vyzvednete v ateliéru — elektronický vám pošlu e-mailem a žádnou dopravu nepotřebuje.",
}

export const restrictionRowHint: Record<
  NonNullable<DeliveryRestriction>,
  string
> = {
  fragile: "U křehkých kusů to bohužel nejde",
  commission: "U zakázkové výroby to bohužel nejde",
  voucher: "Samotný poukaz dopravcem neposíláme",
}
