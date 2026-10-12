/**
 * When dobírka may be offered.
 *
 * Three conditions, all of which must hold. Each exists for its own reason, so none of them
 * can be dropped as "probably fine":
 *
 * 1. **Every piece in the basket allows it.** Opt-in per product in the admin, because a
 *    refused parcel costs her the carriage both ways — survivable on a mug, not on a
 *    commission. One piece that forbids it forbids it for the basket: money is collected once,
 *    for the whole parcel, so there is no partial answer.
 * 2. **The delivery is a Česká pošta carriage.** They are the ones who collect. Osobní odběr
 *    has its own "pay when you collect", and a carrier that does not do dobírka cannot be
 *    asked to.
 * 3. **The customer is in Czechia.** The service does not cross the border, and offering it to
 *    someone in Slovakia produces an order that cannot be fulfilled as sold.
 */

import { isPackagingLine } from "./packaging"

export const DOBIRKA_COUNTRIES = new Set(["cz"])

type LineLike = {
  product?: { metadata?: Record<string, unknown> | null } | null
  metadata?: Record<string, unknown> | null
  variant_id?: string | null
  product_id?: string | null
}

/** Opt-in, per product. Absent metadata means no. */
export const lineAllowsDobirka = (item: LineLike) =>
  Boolean(item?.product?.metadata?.cod_allowed)

/**
 * The doběrečné line the backend adds when dobírka is chosen. It is a fee,
 * not a product — it must never count against the per-product opt-in (it has
 * no product), and the UI hides its quantity/remove controls: it appears and
 * disappears with the payment choice only.
 *
 * Marker AND no product behind the line — the same identity the backend
 * enforces: `metadata` is client-writable on every line-item route, so a
 * marker on a variant-backed line is a forgery and stays an ordinary product
 * row here (with its controls, and counted against the per-product opt-in).
 */
export const isDobirkaFeeLine = (item: LineLike | null | undefined) =>
  Boolean(item?.metadata?.dobirka_fee) && !item?.variant_id && !item?.product_id

/** The same fact read off the product itself — the PDP says it up front. */
export const productAllowsDobirka = (
  product?: { metadata?: Record<string, unknown> | null } | null
) => Boolean(product?.metadata?.cod_allowed)

/** One piece that forbids it forbids it for the basket — the carrier collects once. */
export const cartAllowsDobirka = (cart: { items?: LineLike[] | null } | null) => {
  // Without this filter, adding the fee (which happens the moment dobírka is
  // chosen) would immediately flip the answer to "no" and hide the option
  // the customer just picked.
  // Balné (lib/util/packaging.ts) taky není výrobek — bez produktu by
  // „každý kus dovolí dobírku" vyšlo vždy ne.
  const items = (cart?.items ?? []).filter(
    (item) => !isDobirkaFeeLine(item) && !isPackagingLine(item)
  )
  return items.length > 0 && items.every(lineAllowsDobirka)
}

/**
 * The country actually used for delivery, preferring what the customer typed over the shop
 * version they happen to be browsing — someone on the Czech storefront shipping to Slovakia
 * is shipping to Slovakia.
 */
export const deliveryCountry = (
  cart: { shipping_address?: { country_code?: string | null } | null } | null,
  routeCountryCode: string
) =>
  (cart?.shipping_address?.country_code || routeCountryCode || "").toLowerCase()

export const countryAllowsDobirka = (
  cart: { shipping_address?: { country_code?: string | null } | null } | null,
  routeCountryCode: string
) => DOBIRKA_COUNTRIES.has(deliveryCountry(cart, routeCountryCode))

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("cs")

/**
 * Česká pošta NA ADRESU, by the option's own name — the same handle the owner controls.
 *
 * Balíkovna se dobírkou neposílá na žádné výdejní místo (Matěj, 11. 10. 2026):
 * do boxu se dobírka platí jen předem kartou online a na výdejnu chodí lidi
 * zásilku jen vyzvednout — platí předem kartou. Dobírka tedy jen tam, kde
 * peníze vybere doručovatel u dveří. Backend to hlídá taky (validate-dobirka).
 */
export const deliveryCollectsDobirka = (
  option: { name?: string | null } | null | undefined,
  isPickup: boolean
) => {
  if (isPickup) return false
  const name = fold(option?.name ?? "")
  return name.includes("ceska posta") && !name.includes("balikovna")
}
