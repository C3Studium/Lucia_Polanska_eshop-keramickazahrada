import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Sending a customer e-mail (WorkflowPlan.md §16).
 *
 * ## Why this exists rather than calling `createNotifications` directly
 *
 * Thirty-four Czech templates sit in `src/modules/resend/emails/` and, until
 * now, roughly seven were ever sent. Wiring the rest means twelve call sites
 * that all have to get the same four things right, and getting any of them
 * wrong is visible to a customer:
 *
 * 1. **A dedupe key on every send.** At-least-once event delivery means a
 *    handler runs more than once; without a key that is a second e-mail in
 *    somebody's inbox. `createNotifications` skips a key it has already sent
 *    and retries one that failed.
 * 2. **A recipient that exists.** An order with no e-mail address must be
 *    skipped quietly, not sent to `undefined`.
 * 3. **Czech formatting.** Money and dates are rendered here, once, so
 *    „2 450 Kč" cannot become „2450" in one template and „2,450.00" in another.
 * 4. **`resource_id`**, so the „Odeslané e-maily" widget can show every mail
 *    ever sent about an order (§16, P5-3).
 *
 * Failures are not swallowed. Since the Resend provider throws on a real
 * failure, the notification row is written as `status = failure`, which the
 * poller turns into notification #15 and `/prehled/emaily` lists for retry.
 */

export type CustomerEmailInput = {
  /** Template name, as registered in the Resend provider. */
  template: string
  to: string | null | undefined
  /** §16 dedupe key, e.g. `ship:{fulfillment_id}`. */
  key: string
  data: Record<string, unknown>
  /** Links the mail to an order so it shows on the order's e-mail widget. */
  orderId?: string | null
}

export const formatMoney = (
  amount: unknown,
  currencyCode?: string | null
): string => {
  const numeric = Number(
    amount && typeof amount === "object"
      ? (amount as any).value ?? (amount as any).numeric_ ?? 0
      : amount
  )
  if (!Number.isFinite(numeric)) {
    return "—"
  }
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: String(currencyCode || "CZK").toUpperCase(),
  }).format(numeric)
}

export const formatDate = (value: unknown): string => {
  if (!value) {
    return "—"
  }
  const date = new Date(value as string)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date)
}

/** „Jana Nováková", or a polite fallback — never „undefined undefined". */
export const customerName = (order: any): string => {
  const candidates = [
    [order?.customer?.first_name, order?.customer?.last_name],
    [order?.shipping_address?.first_name, order?.shipping_address?.last_name],
    [order?.billing_address?.first_name, order?.billing_address?.last_name],
  ]
  for (const [first, last] of candidates) {
    const name = [first, last].filter(Boolean).join(" ").trim()
    if (name) {
      return name
    }
  }
  return "Vážený zákazníku"
}

export const orderNumber = (order: any): string =>
  `#${order?.display_id ?? ""}`.trim()

/**
 * The storefront's own base URL and country segment.
 *
 * Every storefront route is under `/[countryCode]/…`, so a link without one
 * 404s. `cz` matches `NEXT_PUBLIC_DEFAULT_REGION`; it is overridable in case a
 * second region is ever added.
 */
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
 * Where a customer goes to look at their order.
 *
 * Path verified against the storefront's actual routes
 * (`app/[countryCode]/(main)/order/[id]/confirmed`). An invented path is worse
 * than no link: the customer clicks, gets a 404, and concludes the shop is
 * broken.
 */
export const orderLink = (order: any): string => {
  const base = storefrontBase()
  return base && order?.id ? `${base}/order/${order.id}/confirmed` : ""
}

/**
 * A product page. The storefront routes products by **handle**, not id
 * (`products/[handle]`), so passing an id produces a page that does not exist.
 */
export const productLink = (handle?: string | null): string => {
  const base = storefrontBase()
  return base && handle ? `${base}/products/${handle}` : ""
}

/**
 * Sends one customer e-mail, or does nothing if there is nobody to send it to.
 *
 * Returns whether it was queued, so callers can log honestly rather than
 * assuming.
 */
export const sendCustomerEmail = async (
  container: MedusaContainer,
  input: CustomerEmailInput
): Promise<boolean> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const recipient = (input.to ?? "").trim()
  if (!recipient) {
    logger.warn(
      `[emails] Přeskakuji „${input.template}" (${input.key}) — objednávka nemá e-mailovou adresu.`
    )
    return false
  }

  const notifications = container.resolve(Modules.NOTIFICATION)

  await notifications.createNotifications({
    to: recipient,
    channel: "email",
    template: input.template,
    idempotency_key: input.key,
    trigger_type: input.template,
    ...(input.orderId
      ? { resource_id: input.orderId, resource_type: "order" }
      : {}),
    data: input.data,
  } as never)

  return true
}
