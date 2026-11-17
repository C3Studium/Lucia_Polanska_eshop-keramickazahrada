import { isBalikovnaOption } from "./balikovna"
import { isDobirkaFeeLine } from "./dobirka"
import { isPackagingLine } from "./packaging"

/**
 * Které druhy dopravy košík smí (17. 11. 2026, Matěj).
 *
 * - **Dopis České pošty** — jen pro košík, ve kterém nejsou nic než
 *   (tištěné) poukazy. Takový košík naopak nevidí balíkové volby: poukaz se
 *   balíkem neposílá.
 * - **Balíkovna BOX / výdejní místo** — jen malá zásilka bez křehkého kusu
 *   (křehké a zakázky hlídá `deliveryAllowedUnder`, velikost tady).
 * - **Česká pošta a Balíkovna na adresu** — vždy (malá/velká, křehké,
 *   dobírka). Osobní odběr vždy.
 *
 * Backend totéž hlídá v `validate-dobirka.ts`; cenu počítá poskytovatel.
 */

type LineLike = {
  product?: { metadata?: Record<string, unknown> | null } | null
  metadata?: Record<string, unknown> | null
  variant_id?: string | null
  product_id?: string | null
}

const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("cs")

const truthy = (value: unknown) => value === true || value === "true"

/** Třída zásilky výrobku — stejné pravidlo jako backend lib/shipping-rates. */
export const shippingClassOfProduct = (metadata: Record<string, unknown> | null | undefined) => {
  const meta = metadata ?? {}
  const stored = String(meta.shipping_class ?? "")
  if (stored === "male" || stored === "velke" || stored === "poukaz") return stored
  return truthy(meta.gift_voucher) || truthy(meta.voucher_custom_amount) ? "poukaz" : "male"
}

const goodsOf = (cart: { items?: LineLike[] | null } | null | undefined) =>
  ((cart?.items ?? []) as LineLike[]).filter(
    (item) => !isPackagingLine(item as never) && !isDobirkaFeeLine(item as never)
  )

/** V košíku jsou jen poukazy (a aspoň jeden). */
export const cartOnlyVouchers = (cart: { items?: LineLike[] | null } | null | undefined) => {
  const goods = goodsOf(cart)
  return goods.length > 0 && goods.every((item) => shippingClassOfProduct(item.product?.metadata) === "poukaz")
}

/** V košíku je aspoň jeden velký kus. */
export const cartHasLarge = (cart: { items?: LineLike[] | null } | null | undefined) =>
  goodsOf(cart).some((item) => shippingClassOfProduct(item.product?.metadata) === "velke")

/** Dopis s poukazy (volba „Česká pošta – dopis"). */
export const isLetterOption = (option: { name?: string | null } | null | undefined) =>
  fold(option?.name ?? "").includes("dopis")

/** Smí košík tuhle volbu dopravy (bez křehkého/zakázky — to řeší `deliveryAllowedUnder`)? */
export const shippingKindAllowed = (
  option: { name?: string | null } | null | undefined,
  isPickup: boolean,
  cart: { items?: LineLike[] | null } | null | undefined
) => {
  if (isPickup) return true
  const onlyVouchers = cartOnlyVouchers(cart)
  if (isLetterOption(option)) return onlyVouchers
  if (onlyVouchers) return false
  if (isBalikovnaOption(option)) return !cartHasLarge(cart)
  return true
}
