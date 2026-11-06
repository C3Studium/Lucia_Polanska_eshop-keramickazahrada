import {
  cartHasCommissionCategory,
  deliveryAllowsCommission,
} from "./commission"
import { hasPriceOnRequestLine } from "./price-on-request"

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
/**
 * Čtvrtý důvod, 30. 10. 2026: **cena po domluvě**. Takový kus se objedná za
 * 0 Kč a cenu — a s ní i poštovné — Lucie domluví až po objednávce.
 *
 * Do 6. 11. 2026 u něj zbýval jen osobní odběr: vypadalo to, že není z čeho
 * dopravu spočítat, protože zákazník by si vybral balík za 150 Kč k výrobku
 * za nulu. Spočítat ji ale netřeba — stačí ji nechat VYBRAT a nechtít za ni
 * teď peníze. Košík, ve kterém není nic než zakázka, totiž poštovné
 * v pokladně neplatí (`shippingTiming` v backendovém `lib/deposit-split.ts`):
 * odloží se do doplatku. Zákazník tedy dopravu zvolí, zaplatí 0 Kč a poštovné
 * dostane k zaplacení spolu s domluvenou cenou — jedním odkazem
 * z administrace.
 *
 * Omezení se tím srovnalo s ostatními: křehký balík, nebo odběr. Volnější
 * zůstat nemohlo, je to pořád ručně dělaná keramika.
 */
export type DeliveryRestriction =
  | "fragile"
  | "commission"
  | "price_on_request"
  | null

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
  /*
   * Poukaz dopravu NEOMEZUJE (31. 10. 2026).
   *
   * Do té doby šel košík jen s poukazy vyzvednout osobně: vytištěnou
   * kartičku předávala majitelka v dílně. Rozhodla jinak — kartička se dá
   * poslat jako cokoli jiného, takže se nabízí všechny dopravy a volba je
   * na zákazníkovi. Elektronický poukaz dopravu nepotřebuje vůbec
   * (`requires_shipping: false`), takže se ho to netýká.
   */
  /* Cena po domluvě PŘED křehkým: u takového kusu platí obojí a dovolují už
     totéž, ale její věta nese navíc to hlavní — že se cena výrobku domluví
     a zaplatí až potom. Stačí jediný takový kus v košíku: dělit zásilku na
     „tohle pošlu a pro zbytek si přijďte" pokladna neumí. */
  if (hasPriceOnRequestLine(cart?.items as never)) return "price_on_request"
  if (cartHasFragile(cart)) return "fragile"
  if (cartHasCommissionCategory(cart) || hasCommissionProfile) return "commission"
  return null
}

/**
 * Co smí takový košík odvézt. Všechny tři důvody dovolí totéž — křehký balík,
 * nebo osobní odběr. Liší se jen věta, kterou zákazník čte.
 *
 * Cena po domluvě sem spadla 6. 11. 2026 (viz hlavička souboru). Do té doby
 * u ní zbýval jen odběr; poštovné se ale v takovém košíku v pokladně neplatí,
 * takže si zákazník může dopravu vybrat a zaplatí ji až s domluvenou cenou.
 */
export const deliveryAllowedUnder = (
  option: { name?: string | null } | null | undefined,
  isPickup: boolean,
  restriction: DeliveryRestriction = null
) => (restriction === null ? true : deliveryAllowsCommission(option, isPickup))

export const restrictionNotice: Record<
  NonNullable<DeliveryRestriction>,
  string
> = {
  fragile:
    "Vybrali jste křehký kus. Aby dorazil v pořádku, posíláme ho jen jako křehký balík Českou poštou — nebo si pro něj můžete přijet do ateliéru.",
  commission:
    "Zakázkovou výrobu posíláme jen jako křehký balík. Nebo si pro ni můžete přijet do ateliéru.",
  price_on_request:
    "V košíku máte výrobek s cenou po domluvě. Vyberte si tady, jak vám ho mám doručit; posílám jen jako křehký balík, nebo si pro kus můžete přijet do ateliéru. Cenu výrobku vám pak pošlu e-mailem a zaplatíte ji až potom.",
}

export const restrictionRowHint: Record<
  NonNullable<DeliveryRestriction>,
  string
> = {
  fragile: "U křehkých kusů to bohužel nejde",
  commission: "U zakázkové výroby to bohužel nejde",
  price_on_request: "U zakázkové výroby to bohužel nejde",
}
