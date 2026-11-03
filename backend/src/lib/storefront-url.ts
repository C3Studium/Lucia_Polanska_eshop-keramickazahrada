/**
 * Every link we put in front of a customer.
 *
 * ## Why this is its own module
 *
 * These helpers started inside `customer-email.ts`, which imports the Medusa
 * framework. React Email templates cannot import that — it drags the whole
 * container into the preview renderer — so two templates built their own URLs
 * from `process.env` instead. That is how a second, slightly different idea of
 * "where the storefront is" gets into the codebase: one chain reading
 * `MEDUSA_STOREFRONT_URL` with a hard-coded fallback, another reading
 * `STOREFRONT_PUBLIC_URL` first. They agree today and would not have for long.
 *
 * This file has no imports (except Node's AsyncLocalStorage for the e-mail
 * country, see `withStorefrontCountry`), so anything can use it, and there is exactly one
 * answer to what a customer-facing URL looks like.
 *
 * ## About the country segment
 *
 * Storefront routes live under `/[countryCode]/…`. A path without one is *not*
 * broken — `storefront/src/middleware.ts` 307-redirects it and preserves the
 * query string. We emit the segment anyway so the address in the e-mail is the
 * address the customer lands on: no redirect hop, and a link that still reads
 * correctly if it is copied, shared, or logged.
 *
 * What genuinely does break is a wrong *route name*, which no redirect can
 * rescue. Every path below is verified against `storefront/src/app`, and
 * `__tests__/storefront-url.unit.spec.ts` pins the shapes so a rename over
 * there fails the build over here.
 */

import { AsyncLocalStorage } from "node:async_hooks"

/** Země odkazů pro právě odesílaný e-mail (`withStorefrontCountry`). */
const linkCountry = new AsyncLocalStorage<string>()

/** Base URL including the country segment, or `""` when unconfigured. */
export const storefrontBase = (): string => {
  const base = (
    process.env.STOREFRONT_PUBLIC_URL ||
    process.env.MEDUSA_STOREFRONT_URL ||
    ""
  ).replace(/\/+$/, "")

  if (!base) {
    return ""
  }

  // Uvnitř odesílání cizojazyčného e-mailu země jeho jazyka (viz
  // `withStorefrontCountry` dole), jinak výchozí země obchodu.
  const country = (linkCountry.getStore() || process.env.STOREFRONT_COUNTRY || "cz").toLowerCase()
  return `${base}/${country}`
}

/**
 * An order's own page — `app/[countryCode]/(main)/order/[id]/confirmed`.
 *
 * Also where the balance-payment route returns the customer, with
 * `?platba=<outcome>`.
 */
export const orderLink = (order: any): string => {
  const base = storefrontBase()
  return base && order?.id ? `${base}/order/${order.id}/confirmed` : ""
}

/**
 * Relativní cesta na stránku objednávky — pro ComGate `url_paid` / `url_cancelled`
 * / `url_pending`, které se v comgate modulu resolvují proti STOREFRONT_PUBLIC_URL,
 * a proto MUSÍ začínat „/" (viz `resolveStorefrontReturnUrl`). Sem se vrací
 * zákazník po zaplacení DOPLATKU: bez toho ComGate padal na neexistující
 * `/{country}/payment/{session}/confirmed` → 404. Stránka `order/[id]/confirmed`
 * je balance-aware a `?platba=` si přečte (i pro hosta přes OrderStateShell).
 */
export const orderConfirmedPath = (
  orderId: string,
  platba?: string
): string => {
  const country = (process.env.STOREFRONT_COUNTRY || "cz").toLowerCase()
  const query = platba ? `?platba=${encodeURIComponent(platba)}` : ""
  return `/${country}/order/${orderId}/confirmed${query}`
}

/**
 * A product page — `app/[countryCode]/(main)/products/[handle]`.
 *
 * By **handle**, not id. An id produces a page that does not exist, which is
 * exactly the bug this module was extracted after.
 */
export const productLink = (handle?: string | null): string => {
  const base = storefrontBase()
  return base && handle ? `${base}/products/${handle}` : ""
}

/**
 * Recovering an abandoned cart —
 * `app/[countryCode]/(main)/cart/recover/[id]`.
 */
export const cartRecoverLink = (cartId?: string | null): string => {
  const base = storefrontBase()
  return base && cartId ? `${base}/cart/recover/${cartId}` : ""
}

/** The shop listing — `app/[countryCode]/(main)/store`. */
export const storeLink = (): string => {
  const base = storefrontBase()
  return base ? `${base}/store` : ""
}

/** Detail objednávky v účtu — tam bydlí editace. */
export const accountOrderLink = (orderId?: string | null): string => {
  const base = storefrontBase()
  return base && orderId ? `${base}/account/orders/details/${orderId}` : ""
}

/** A customer's own order history — `app/[countryCode]/(main)/account/orders`. */
export const accountOrdersLink = (): string => {
  const base = storefrontBase()
  return base ? `${base}/account/orders` : ""
}

/**
 * Reklamace / vrácení zboží — `app/[countryCode]/(main)/reklamacni-protokol`.
 * Stránka s reklamačním řádem a formulářem (vada zboží, 24 měsíců).
 */
export const complaintLink = (): string => {
  const base = storefrontBase()
  return base ? `${base}/reklamacni-protokol` : ""
}

/**
 * Odstoupení od smlouvy do 14 dnů —
 * `app/[countryCode]/(main)/odstoupeni-od-smlouvy`. Vzor oznámení dle §1829
 * (zrušení objednávky / vrácení bez udání důvodu u zásilkového prodeje).
 */
export const withdrawalLink = (): string => {
  const base = storefrontBase()
  return base ? `${base}/odstoupeni-od-smlouvy` : ""
}

/**
 * E-mail verification — `app/[countryCode]/(main)/verify-email`.
 *
 * Used to be built inline in two places (the customer.created subscriber and
 * the resend route) off `configModule.admin.storefrontUrl`, a THIRD idea of
 * where the storefront lives, with an unencoded e-mail in the query.
 */
export const verifyEmailLink = (
  token?: string | null,
  email?: string | null
): string => {
  const base = storefrontBase()
  return base && token && email
    ? `${base}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
    : ""
}

/**
 * Password reset — `app/[countryCode]/(main)/reset-password`.
 *
 * Used to be built off `configModule.admin.storefrontUrl` with a
 * `https://storefront.com` fallback — a live reset token mailed to a domain
 * nobody owns. Empty when unconfigured, so the caller can refuse to send
 * instead of sending a wrong link.
 */
export const resetPasswordLink = (
  token?: string | null,
  email?: string | null
): string => {
  const base = storefrontBase()
  return base && token && email
    ? `${base}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
    : ""
}

/**
 * The storefront's bare origin — no country segment.
 *
 * Everything above builds customer-facing pages, which live under
 * `/[countryCode]/…`. The admin bridge posts to `/api/admin-bridge`, a route
 * handler that sits outside that segment, so it needs the origin on its own.
 */
export const storefrontOrigin = (): string =>
  (
    process.env.STOREFRONT_PUBLIC_URL ||
    process.env.MEDUSA_STOREFRONT_URL ||
    ""
  ).replace(/\/+$/, "")

/** Země obchodu pro jazyk e-mailu — kam má vést odkaz cizojazyčného e-mailu. */
const LOCALE_COUNTRY: Record<string, string> = { sk: "sk", pl: "pl", de: "de" }

/**
 * Země odkazů v e-mailu: země obchodu, ve které zákazník nakupoval
 * (`country` — `order.metadata.country_code` ze storefrontu, jinak země
 * doručení), a když ji neznáme, země jazyka e-mailu. Angličtina žádnou „svoji"
 * zemi nemá (jde Francouzům, Italům…), takže bez známé země odkaz zůstane
 * ve výchozí zemi obchodu.
 */
export const linkCountryFor = (
  locale: string | null | undefined,
  country?: string | null
): string | undefined => {
  const code = typeof country === "string" ? country.trim().toLowerCase() : ""
  if (/^[a-z]{2}$/.test(code)) return code
  return locale ? LOCALE_COUNTRY[locale] : undefined
}

/** Totéž nad načtenou objednávkou (nebo daty e-mailu s `order`). */
export const storefrontCountryOf = (order: any): string | null => {
  const candidates = [
    order?.metadata?.country_code,
    order?.shipping_address?.country_code,
    order?.billing_address?.country_code,
  ]
  for (const value of candidates) {
    const code = typeof value === "string" ? value.trim().toLowerCase() : ""
    if (/^[a-z]{2}$/.test(code)) return code
  }
  return null
}

/**
 * Šablony si část odkazů staví až při vykreslení (`storeLink()`,
 * `orderLink(order)`), a to Resend dělá uvnitř `emails.send`. Provider proto
 * odeslání obalí zemí jazyka e-mailu a `storefrontBase()` si ji odsud
 * přečte — jedna změna místo úprav v každé šabloně. AsyncLocalStorage drží
 * zemi jen pro tenhle asynchronní běh, souběžné e-maily se nepletou.
 */
export const withStorefrontCountry = <T>(
  locale: string | null | undefined,
  run: () => T,
  countryCode?: string | null
): T => {
  const country = linkCountryFor(locale, countryCode)
  return country ? linkCountry.run(country, run) : run()
}

/**
 * Odkazy na storefront v datech e-mailu přepíše z výchozí země (`/cz/…`) na
 * zemi jazyka e-mailu (`/sk/…`).
 *
 * Proč: všechny odkazy výše staví `storefrontBase()` s jednou zemí. Slovák,
 * který klikne na „Zobraziť objednávku", by skončil v českém obchodě
 * s korunami — a košík by se mu mohl přepnout do českého regionu. Přepis se
 * dělá v provideru nad celými daty (i u potvrzení objednávky, které jde mimo
 * `sendCustomerEmail`, a u opakovaného odeslání), takže jednotlivé odkazy
 * o jazyku vědět nemusí. Mění se jen segment země, nic jiného — podepsané
 * tokeny v query zůstávají, jak jsou.
 */
export const localizeStorefrontLinks = <T>(
  data: T,
  locale: string | null | undefined,
  countryCode?: string | null
): T => {
  const country = linkCountryFor(locale, countryCode)
  const base = storefrontBase()
  if (!country || !base) {
    return data
  }
  const origin = base.slice(0, base.lastIndexOf("/"))
  const from = `${base}/`
  const to = `${origin}/${country}/`
  if (from === to) {
    return data
  }
  const walk = (value: unknown, depth: number): unknown => {
    if (depth > 8) return value
    if (typeof value === "string") {
      return value.startsWith(from) ? to + value.slice(from.length) : value
    }
    if (Array.isArray(value)) return value.map((item) => walk(item, depth + 1))
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {}
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        out[key] = walk(item, depth + 1)
      }
      return out
    }
    return value
  }
  return walk(data, 0) as T
}
