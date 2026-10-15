/**
 * Prosba o recenzi — jedna cesta pro job `request-reviews` i ruční odeslání
 * z adminu (docs/sledovani-zasilek.md §6).
 *
 * Job rozhoduje KDY (týden po převzetí, okno 30 dnů, reklamace); tady je jen
 * CO a KAM: data šablony `order-review` a dedupe klíč. Ruční odeslání jde
 * stejnou šablonou, takže „jak to vypadá" se dá ověřit bez čekání na job.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isServiceLine } from "./packaging-lines"
import { isEmailOptedOut } from "./email-optout"
import { emailOptOutUrl } from "./email-optout-link"
import {
  customerName,
  orderLink,
  orderNumber,
  productLink,
  sendCustomerEmail,
} from "./customer-email"
import { googleReviewUrl } from "./google-review-url"

/** Pole objednávky, která šablona potřebuje — job i route načítají totéž. */
export const REVIEW_ORDER_FIELDS = [
  "id",
  "status",
  "email",
  "display_id",
  "customer.first_name",
  "customer.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_methods.name",
  "shipping_methods.data",
  "shipping_methods.shipping_option.provider_id",
  "fulfillments.shipped_at",
  "fulfillments.canceled_at",
  "items.title",
  "items.product_title",
  "items.thumbnail",
  "items.product_id",
  "items.variant_id",
  "items.metadata",
  "items.variant.product.handle",
]

/** Per objednávka — vícebalíková objednávka prosí jednou. */
export const reviewRequestKey = (orderId: string): string =>
  `review-request:${orderId}`

export const buildReviewEmailData = (order: any): Record<string, unknown> => {
  // První VÝROBEK — balné ani doběrečné recenzi nedostanou.
  const item = ((order.items || []) as any[]).find((line) => !isServiceLine(line))
  // Handle, ne id — storefront routuje produkty podle handle.
  const handle = item?.variant?.product?.handle ?? null
  const link = productLink(handle)
  return {
    customerName: customerName(order),
    orderNumber: orderNumber(order),
    orderLink: orderLink(order),
    // `product_title` je název produktu; `title` položky je varianta („Ø 32 cm"),
    // která jako název nedává smysl.
    productName: item?.product_title ?? item?.title ?? "váš kousek",
    productImage: item?.thumbnail ?? "",
    productLink: link,
    reviewLink: link ? `${link}#hodnoceni` : "",
    googleReviewLink: googleReviewUrl() ?? "",
    // Prosba jde z oprávněného zájmu bez souhlasu — v každé musí být odkaz,
    // kterým další odmítne (§ 7 odst. 3 zák. 480/2004 Sb.; OP čl. XIV).
    unsubscribe_url: emailOptOutUrl(order.email, "review_request"),
  }
}

/**
 * Odmítl zákazník prosby o recenzi odkazem z dřívějšího e-mailu? Pak se
 * neposílají ani z jobu, ani ručně z adminu (námitka platí pro oba).
 */
export const reviewRequestOptedOut = (
  container: MedusaContainer,
  order: any
): Promise<boolean> => isEmailOptedOut(container, order?.email, "review_request")

/**
 * Pošle prosbu o recenzi. `key` jiný než výchozí = vědomé opakování (ruční
 * odeslání s `force`) — dedupe jinak druhou prosbu zahodí. Adresa, která
 * prosby odmítla, se přeskočí (vrací `false`).
 */
export const sendReviewRequest = async (
  container: MedusaContainer,
  order: any,
  options: { key?: string } = {}
): Promise<boolean> => {
  if (await reviewRequestOptedOut(container, order)) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .info(
        `[reviews] Objednávka #${order?.display_id ?? order?.id}: zákazník prosby o recenzi odmítl — neposílám.`
      )
    return false
  }
  return sendCustomerEmail(container, {
    template: "order-review",
    to: order.email,
    key: options.key ?? reviewRequestKey(order.id),
    orderId: order.id,
    data: buildReviewEmailData(order),
  })
}
