import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  customerName,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../lib/customer-email"
import { getMerchantSettings } from "../lib/merchant-settings"

/**
 * Asks — once — how the piece turned out (§12, §16 #14, P9-2).
 *
 * ## The rules that make this bearable rather than spam
 *
 * **One ask, never a reminder.** §12 is explicit: „one polite ask". A shop this
 * size trades on the customer liking the person who made the thing, and
 * nagging them for a review is the fastest way to spend that.
 *
 * **Only after it has actually arrived.** The wait is measured from the
 * *shipment*, not the order, and defaults to ten days
 * (`review_request_days`) — long enough that a ČP parcel has arrived and been
 * unwrapped, so the question is answerable when it is asked.
 *
 * **Never for a cancelled order**, and never twice: the dedupe key is the
 * order, so a restart or a changed schedule cannot produce a second ask.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Bounded so one long-dormant deployment cannot mail years of history. */
const MAX_PER_RUN = 50

export default async function requestReviews(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const settings = await getMerchantSettings(container)

  const waitDays = settings.review_request_days
  const now = Date.now()

  // The window has a floor as well as a ceiling. Without one, enabling this on
  // an established shop would mail every customer who ever bought anything.
  const shippedBefore = new Date(now - waitDays * DAY_MS)
  const shippedAfter = new Date(now - (waitDays + 30) * DAY_MS)

  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: [
      "id",
      "shipped_at",
      "canceled_at",
      "order.id",
      "order.status",
      "order.email",
      "order.display_id",
      "order.customer.first_name",
      "order.customer.last_name",
      "order.shipping_address.first_name",
      "order.shipping_address.last_name",
      "order.items.title",
      "order.items.thumbnail",
      "order.items.product_id",
    ],
    filters: {
      shipped_at: { $gte: shippedAfter, $lte: shippedBefore },
    },
  })

  let sent = 0

  for (const fulfillment of (fulfillments as any[]).slice(0, MAX_PER_RUN)) {
    const order = fulfillment?.order
    if (!order?.id || fulfillment.canceled_at) {
      continue
    }
    if (order.status === "canceled") {
      continue
    }

    const item = (order.items || [])[0]
    const storefront = (
      process.env.STOREFRONT_PUBLIC_URL ||
      process.env.MEDUSA_STOREFRONT_URL ||
      ""
    ).replace(/\/+$/, "")

    const ok = await sendCustomerEmail(container, {
      template: "order-review",
      to: order.email,
      // Per order, so a multi-parcel order still asks once.
      key: `review-request:${order.id}`,
      orderId: order.id,
      data: {
        customerName: customerName(order),
        orderNumber: orderNumber(order),
        orderLink: orderLink(order),
        productName: item?.title ?? "váš kousek",
        productImage: item?.thumbnail ?? "",
        productLink:
          storefront && item?.product_id
            ? `${storefront}/produkt/${item.product_id}`
            : "",
        reviewLink:
          storefront && item?.product_id
            ? `${storefront}/produkt/${item.product_id}#hodnoceni`
            : "",
      },
    })

    if (ok) {
      sent += 1
    }
  }

  if (sent) {
    logger.info(`[reviews] Odesláno ${sent} proseb o recenzi.`)
  }
}

export const config = {
  name: "request-reviews",
  // 10:00 — a friendly hour, and well clear of the morning notification burst.
  schedule: "0 10 * * *",
}
