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

export const DOBIRKA_COUNTRIES = new Set(["cz"])

type LineLike = {
  product?: { metadata?: Record<string, unknown> | null } | null
}

/** Opt-in, per product. Absent metadata means no. */
export const lineAllowsDobirka = (item: LineLike) =>
  Boolean(item?.product?.metadata?.cod_allowed)

/** The same fact read off the product itself — the PDP says it up front. */
export const productAllowsDobirka = (
  product?: { metadata?: Record<string, unknown> | null } | null
) => Boolean(product?.metadata?.cod_allowed)

/** One piece that forbids it forbids it for the basket — the carrier collects once. */
export const cartAllowsDobirka = (cart: { items?: LineLike[] | null } | null) => {
  const items = cart?.items ?? []
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

/** Česká pošta carriage, by the option's own name — the same handle the owner controls. */
export const deliveryCollectsDobirka = (
  option: { name?: string | null } | null | undefined,
  isPickup: boolean
) => {
  if (isPickup) return false
  const name = fold(option?.name ?? "")
  return name.includes("ceska posta") || name.includes("balikovna")
}
