import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  customerName,
  orderLink,
  orderNumber,
  productLink,
  sendCustomerEmail,
} from "../lib/customer-email"
import { googleReviewUrl } from "../lib/google-review-url"
import { getMerchantSettings } from "../lib/merchant-settings"
import {
  claimVerdict,
  isInReviewWindow,
  isPickupOrder,
  latestShippedAt,
  receivedAtFor,
  REVIEW_WINDOW_DAYS,
  UNTRACKED_DELIVERY_PADDING_DAYS,
} from "../lib/review-request-rules"
import { PARCEL_TRACKING_MODULE } from "../modules/parcel-tracking"
import type ParcelTrackingModuleService from "../modules/parcel-tracking/service"
import { RETURN_REQUEST_MODULE } from "../modules/return-request"
import type ReturnRequestModuleService from "../modules/return-request/service"

/**
 * Asks — once — how the piece turned out (§12, §16 #14, P9-2;
 * docs/sledovani-zasilek.md §6).
 *
 * ## The rules that make this bearable rather than spam
 *
 * **One ask, never a reminder.** §12 is explicit: „one polite ask". A shop this
 * size trades on the customer liking the person who made the thing, and
 * nagging them for a review is the fastest way to spend that.
 *
 * **Measured from the moment the piece was RECEIVED, not shipped.** Sledování
 * zásilek ČP zná den převzetí (`parcel_tracking.delivered_at`); u osobního
 * odběru je převzetí `shipped_at` (vyzvednutí u pultu); jen u nesledované
 * zásilky zůstává dnešní odhad `shipped_at` + 3 dny. Pak `review_request_days`
 * (default týden), okno 30 dnů.
 *
 * **Never for a cancelled order, never over a claim** — otevřená reklamace se
 * odloží, zamítnutá / zrušená / vyřízená vrácením peněz prosbu zruší. A never
 * twice: the dedupe key is the order, so a restart or a changed schedule
 * cannot produce a second ask.
 *
 * **Kam:** hlavní tlačítko vede na recenzi na Google (`GOOGLE_REVIEW_URL` /
 * `GOOGLE_PLACE_ID`), vedlejší na hodnocení produktu na webu.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Bounded so one long-dormant deployment cannot mail years of history. */
const MAX_PER_RUN = 50

const ORDER_FIELDS = [
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
  "items.variant.product.handle",
]

export default async function requestReviews(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const trackingService = container.resolve<ParcelTrackingModuleService>(
    PARCEL_TRACKING_MODULE
  )
  const claimsService = container.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )
  const settings = await getMerchantSettings(container)

  const waitDays = settings.review_request_days
  const now = new Date()

  // Hrubé okno pro dotazy — přesné rozhodnutí dělá `isInReviewWindow` per
  // objednávka. Floor i ceiling: without one, enabling this on an established
  // shop would mail every customer who ever bought anything.
  const latestReceived = new Date(now.getTime() - waitDays * DAY_MS)
  const earliestReceived = new Date(
    now.getTime() - (waitDays + REVIEW_WINDOW_DAYS) * DAY_MS
  )

  // 1) Sledované zásilky převzaté v okně.
  const deliveredTrackings = (await trackingService.listParcelTrackings(
    { delivered_at: { $gte: earliestReceived, $lte: latestReceived } } as never,
    { take: MAX_PER_RUN * 2 } as never
  )) as any[]

  // 2) Fulfillmenty odeslané v okně (rozšířené o 3 dny pro nesledované zásilky).
  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "shipped_at", "canceled_at", "order.id"],
    filters: {
      shipped_at: {
        $gte: new Date(
          earliestReceived.getTime() - UNTRACKED_DELIVERY_PADDING_DAYS * DAY_MS
        ),
        $lte: latestReceived,
      },
    },
  })

  const orderIds = new Set<string>()
  for (const tracking of deliveredTrackings) {
    if (tracking?.order_id) orderIds.add(tracking.order_id)
  }
  for (const fulfillment of fulfillments as any[]) {
    if (fulfillment?.order?.id && !fulfillment.canceled_at) {
      orderIds.add(fulfillment.order.id)
    }
  }
  if (!orderIds.size) {
    return
  }

  const ids = [...orderIds]
  const [{ data: orders }, trackings, claims] = await Promise.all([
    query.graph({ entity: "order", fields: ORDER_FIELDS, filters: { id: ids } }),
    trackingService.listParcelTrackings({ order_id: ids } as never) as Promise<any[]>,
    claimsService.listReturnRequests({ order_id: ids } as never) as Promise<any[]>,
  ])

  const trackingByOrder = new Map<string, any>()
  for (const tracking of trackings) trackingByOrder.set(tracking.order_id, tracking)
  const claimsByOrder = new Map<string, any[]>()
  for (const claim of claims) {
    const list = claimsByOrder.get(claim.order_id) ?? []
    list.push(claim)
    claimsByOrder.set(claim.order_id, list)
  }

  let sent = 0
  let deferred = 0

  for (const order of (orders as any[]).slice(0, MAX_PER_RUN)) {
    if (!order?.id || order.status === "canceled") {
      continue
    }

    const receivedAt = receivedAtFor({
      tracking: trackingByOrder.get(order.id) ?? null,
      shipped_at: latestShippedAt(order.fulfillments),
      is_pickup: isPickupOrder(order),
    })
    if (!receivedAt || !isInReviewWindow(receivedAt, waitDays, now)) {
      continue
    }

    const verdict = claimVerdict(claimsByOrder.get(order.id))
    if (verdict === "defer") {
      deferred++
      continue
    }
    if (verdict === "never") {
      continue
    }

    const item = (order.items || [])[0]
    // Handle, not id — the storefront routes products by handle.
    const handle = item?.variant?.product?.handle ?? null
    const link = productLink(handle)

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
        // `product_title` is the product's name; a line item's `title` is the
        // variant („Ø 32 cm"), which reads like nonsense as a product name.
        productName: item?.product_title ?? item?.title ?? "váš kousek",
        productImage: item?.thumbnail ?? "",
        productLink: link,
        reviewLink: link ? `${link}#hodnoceni` : "",
        googleReviewLink: googleReviewUrl() ?? "",
      },
    })

    if (ok) {
      sent += 1
    }
  }

  if (sent || deferred) {
    logger.info(
      `[reviews] Odesláno ${sent} proseb o recenzi${
        deferred ? `, ${deferred} odloženo kvůli otevřené reklamaci` : ""
      }.`
    )
  }
}

export const config = {
  name: "request-reviews",
  // 10:00 — a friendly hour, and well clear of the morning notification burst.
  schedule: "0 10 * * *",
}
