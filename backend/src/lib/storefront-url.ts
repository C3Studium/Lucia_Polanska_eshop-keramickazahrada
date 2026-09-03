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
 * This file has no imports, so anything can use it, and there is exactly one
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

  const country = (process.env.STOREFRONT_COUNTRY || "cz").toLowerCase()
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
