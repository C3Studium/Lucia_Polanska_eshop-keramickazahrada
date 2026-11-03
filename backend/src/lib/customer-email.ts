import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  emailLocaleOf,
  formatEmailDate,
  formatEmailMoney,
  parseEmailLocale,
  type EmailLocale,
} from "./email-locale"

import { storefrontCountryOf } from "./storefront-url"

export type { EmailLocale } from "./email-locale"

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
  /**
   * PDF přílohy jako odkazy na hostované soubory (https, `.pdf`, nejvýš 5).
   * Jdou do `data.__attachments`, protože opakované odeslání skládá e-mail
   * jen z `data` — viz `attachmentsFromData` v Resend provideru.
   */
  attachments?: Array<{ filename: string; url: string }>
  /**
   * Jazyk e-mailu (lib/email-locale). Bez něj se vezme `data.locale`, pak
   * jazyk objednávky `orderId` (metadata košíku → země doručení), jinak
   * čeština. Volající, který skládá texty do `data` sám (způsob platby,
   * předmět…), si jazyk zjistí dřív přes `emailLocaleForOrder` a předá ho.
   */
  locale?: EmailLocale | null
}

/**
 * Částka do e-mailu. Bez `locale` česky jako vždy; s ním podle jazyka
 * zákazníka (měna je daná objednávkou, mění se jen zápis čísla).
 */
export const formatMoney = (
  amount: unknown,
  currencyCode?: string | null,
  locale?: EmailLocale | null
): string => formatEmailMoney(amount, currencyCode, locale ?? "cs")

/** Datum do e-mailu („2. 11. 2026"; s `locale` podle jazyka zákazníka). */
export const formatDate = (value: unknown, locale?: EmailLocale | null): string =>
  formatEmailDate(value, locale ?? "cs")

/**
 * Země obchodu, ve které se objednávka udělala (`metadata.country_code` ze
 * storefrontu), jinak země doručení nebo fakturace; `null`, když ji nejde
 * zjistit. Nikdy nevyhodí.
 */
export const storefrontCountryForOrder = async (
  container: MedusaContainer,
  orderId: string
): Promise<string | null> => {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "metadata", "shipping_address.country_code", "billing_address.country_code"],
      filters: { id: orderId },
    })
    return storefrontCountryOf((data as any[])[0])
  } catch {
    return null
  }
}

/**
 * Jazyk objednávky pro e-mail — `metadata.locale` (storefront ho zapisuje
 * na košík podle zvolené země), jinak země doručení/fakturace. Nikdy
 * nevyhodí: když objednávku nejde přečíst, je e-mail česky.
 */
export const emailLocaleForOrder = async (
  container: MedusaContainer,
  orderOrId: string | { metadata?: unknown; shipping_address?: unknown; billing_address?: unknown } | null | undefined
): Promise<EmailLocale> => {
  if (!orderOrId) {
    return "cs"
  }
  if (typeof orderOrId === "object") {
    const known = parseEmailLocale((orderOrId.metadata as any)?.locale)
    if (known) return known
    // Rozhodnout z objektu jde jen tehdy, když má země adres načtené —
    // jinak (adresa jen se jménem) se objednávka dočte podle id níž.
    const hasCountry = [orderOrId.shipping_address, orderOrId.billing_address].some(
      (address) => typeof (address as any)?.country_code === "string"
    )
    if (hasCountry) {
      return emailLocaleOf(orderOrId as never)
    }
  }
  const id = typeof orderOrId === "string" ? orderOrId : (orderOrId as any).id
  if (!id) {
    return emailLocaleOf(orderOrId as never)
  }
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "metadata", "shipping_address.country_code", "billing_address.country_code"],
      filters: { id },
    })
    return emailLocaleOf((data?.[0] as never) ?? null)
  } catch {
    return "cs"
  }
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
 * Storefront links live in `lib/storefront-url.ts` and are re-exported here so
 * the existing callers keep their import. They moved because React Email
 * templates cannot import this file — it pulls in the Medusa framework — and
 * two of them had started building their own URLs as a result.
 */
export {
  accountOrdersLink,
  cartRecoverLink,
  orderLink,
  productLink,
  storefrontBase,
  storeLink,
} from "./storefront-url"

/**
 * Sends one customer e-mail, or does nothing if there is nobody to send it to.
 *
 * Returns whether it was queued, so callers can log honestly rather than
 * assuming.
 */
/** Šablony, které zůstávají česky i pro cizojazyčnou objednávku (kurzy jen na /cz). */
const CZECH_ONLY_TEMPLATE = /^course-/

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

  // Jazyk se ukládá do `data` (ne jen do vykreslení), aby opakované odeslání
  // z /prehled/emaily šlo stejně. Kurzy jsou jen na /cz a jejich šablony
  // česky — jazyk se jim nepřidává, ať nevznikne napůl přeložený e-mail.
  const locale = CZECH_ONLY_TEMPLATE.test(input.template)
    ? null
    : input.locale ??
      parseEmailLocale(input.data?.locale) ??
      (input.orderId ? await emailLocaleForOrder(container, input.orderId) : null)
  // Cizojazyčný e-mail k objednávce: odkazy do země obchodu, kde se nakupovalo
  // (u angličtiny jinak nepoznáme, kam odkaz vést) — `linkCountryFor`.
  const linkCountry =
    locale && locale !== "cs" && input.orderId && !input.data?.link_country
      ? await storefrontCountryForOrder(container, input.orderId)
      : null
  const data =
    locale && locale !== "cs"
      ? { ...input.data, locale, ...(linkCountry ? { link_country: linkCountry } : {}) }
      : input.data

  await notifications.createNotifications({
    to: recipient,
    channel: "email",
    template: input.template,
    idempotency_key: input.key,
    trigger_type: input.template,
    ...(input.orderId
      ? { resource_id: input.orderId, resource_type: "order" }
      : {}),
    data: input.attachments?.length
      ? { ...data, __attachments: input.attachments }
      : data,
  } as never)

  return true
}
