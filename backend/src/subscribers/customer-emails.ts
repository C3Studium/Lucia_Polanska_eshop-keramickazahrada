import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  customerName,
  formatDate,
  formatMoney,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../lib/customer-email"
import { balancePaymentUrl } from "../lib/balance-payment-link"
import { refundHistoryOf, toNumber } from "../lib/claims/refund-rules"
import { lineQuantityOf } from "../lib/order-quantity"
import { ensureMadeToOrderInvoices } from "../lib/idoklad-invoice"
import { getMerchantSettings } from "../lib/merchant-settings"
import { cpCarrierName, cpTrackingUrl } from "../lib/parcel-tracking/carrier"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"
import { RETURN_REQUEST_MODULE } from "../modules/return-request"
import type ReturnRequestModuleService from "../modules/return-request/service"

/**
 * The customer lifecycle e-mails (WorkflowPlan.md §16).
 *
 * Twelve Czech templates existed in this repo and none of them were ever sent.
 * A customer paid and heard nothing; their order shipped and they heard
 * nothing; they owed a balance and got no link, because the event that should
 * have sent it — `made-to-order.balance-requested` — had no subscriber at all.
 * This file is what makes the shop talk.
 *
 * Every handler is idempotent through its §16 dedupe key, because event
 * delivery is at-least-once and a duplicate here lands in somebody's inbox.
 *
 * ## What deliberately does *not* send
 *
 * Anything claiming delivery without a real signal, and reminders of any kind
 * (D4 — the balance flow is manual, the system only ever notifies *her*).
 *
 * („Připravujeme" for an ordinary order used to be on this list; it now sends
 * when the merchant moves the order into the „working" stage — see
 * onMerchantStageChanged.)
 */

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "total",
  "metadata",
  "items.*",
  "customer.first_name",
  "customer.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_methods.name",
  "shipping_methods.data",
]

const loadOrder = async (container: SubscriberArgs["container"], orderId: string) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  })
  return (data[0] as any) ?? null
}

const common = (order: any) => ({
  customerName: customerName(order),
  orderNumber: orderNumber(order),
  orderLink: orderLink(order),
})

/**
 * Náhledový obrázek zakázky = obrázek objednaného produktu (ne fotka, kterou
 * poslal sám zákazník). Dřív se do e-mailů tahala „nejnovější sdílená fotka",
 * jenže viditelné jsou i zákazníkovy vlastní zprávy → vracela se zpátky jeho
 * fotka. Bereme náhled položky zakázky, jinak první položky.
 */
const commissionProductImage = (order: any): string | null => {
  const items = (order?.items || []) as any[]
  const item =
    items.find((i: any) => Boolean((i?.metadata as any)?.made_to_order)) ??
    items[0]
  return (item?.thumbnail as string) || null
}

/**
 * #2 „Platba přijata".
 *
 * Skipped when the capture happened within five minutes of the order being
 * placed: the confirmation e-mail already said „děkujeme za objednávku", and a
 * second mail a few seconds later saying „děkujeme za platbu" reads like a
 * system with a stutter. It only earns its place when the money arrives
 * *later* than the order — a balance, a retried card, a bank transfer.
 */
const onPaymentCaptured = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  if (!data?.id) {
    return
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: payments } = await query.graph({
    entity: "payment",
    fields: [
      "id",
      "amount",
      "currency_code",
      "captured_at",
      "provider_id",
      "payment_collection.order.id",
      "payment_collection.order.created_at",
    ],
    filters: { id: data.id },
  })
  const payment = payments[0] as any
  const orderRef = payment?.payment_collection?.order
  if (!orderRef?.id) {
    return
  }

  const placedAt = new Date(orderRef.created_at).getTime()
  const capturedAt = new Date(payment.captured_at ?? Date.now()).getTime()
  if (Number.isFinite(placedAt) && capturedAt - placedAt < 5 * 60 * 1000) {
    return
  }

  const order = await loadOrder(container, orderRef.id)
  if (!order) {
    return
  }

  await sendCustomerEmail(container, {
    template: "payment-received",
    to: order.email,
    key: `payment-received:${payment.id}`,
    orderId: order.id,
    data: {
      ...common(order),
      paymentAmount: formatMoney(payment.amount, payment.currency_code),
      paymentMethod: "Online platba",
    },
  })
}

/**
 * #4 „Prosíme o doplatek" — the dead event, finally subscribed.
 *
 * `made-to-order.balance-requested` has been emitted at two places in the
 * actions route since the module was written, with nothing listening. Every
 * customer who was asked for a balance was asked by hand, or not at all.
 */
const onBalanceRequested = async ({
  event: { data },
  container,
}: SubscriberArgs<{
  order_id: string
  payment_request_id: string
  /**
   * Set only by „Poslat připomínku" — a per-click token that makes the reminder
   * a genuinely new e-mail instead of a duplicate of the first výzva. The first
   * výzva carries none, so its key stays `paylink:{request}`; a redelivery of
   * the same reminder event carries the same token and is still deduped.
   */
  reminder_token?: string
}>) => {
  if (!data?.order_id || !data?.payment_request_id) {
    return
  }

  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const [request] = (await madeToOrder.listProductionPaymentRequests({
    id: data.payment_request_id,
  } as never)) as any[]

  const order = await loadOrder(container, data.order_id)
  if (!order || !request) {
    return
  }

  // Co už proběhlo: kolik je zaplaceno zálohou + zálohová (první) faktura. Ať
  // doplatkový e-mail ukáže „co a za co se platilo" a přiloží odkaz na fakturu.
  const siblingRequests = (await madeToOrder
    .listProductionPaymentRequests({
      production_order_id: request.production_order_id,
    } as never)
    .catch(() => [])) as any[]
  const depositPaid = siblingRequests
    .filter((r) => r.type === "deposit" && r.status === "paid")
    .reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const depositInvoiceUrl =
    typeof meta.idoklad_invoice_pdf_url === "string"
      ? meta.idoklad_invoice_pdf_url
      : null
  const depositInvoiceNumber =
    typeof meta.idoklad_invoice_number === "string"
      ? meta.idoklad_invoice_number
      : null

  await sendCustomerEmail(container, {
    template: "payment-pending",
    to: order.email,
    // Keyed on the request so at-least-once delivery never doubles the first
    // výzva. „Poslat připomínku" passes a per-click token, so a reminder is a
    // new e-mail (same link) rather than a silently-dropped duplicate.
    key: data.reminder_token
      ? `paylink:${request.id}:${data.reminder_token}`
      : `paylink:${request.id}`,
    orderId: order.id,
    data: {
      ...common(order),
      paymentAmount: formatMoney(request.amount, request.currency_code),
      paymentMethod: "Platební karta nebo převod",
      // The link she generated, or the signed one that works from any inbox.
      paymentLink:
        request.payment_url || balancePaymentUrl(order.id) || orderLink(order),
      estimatedConfirmationTime: "Platba se obvykle potvrdí do několika minut.",
      // Obrázek objednaného produktu zakázky (ne fotka od zákazníka).
      makingPhotoUrl: commissionProductImage(order),
      // Co už je zaplaceno (záloha) a první faktura — ať je jasné, co a za co.
      depositPaid:
        depositPaid > 0
          ? formatMoney(depositPaid, request.currency_code)
          : null,
      depositInvoiceUrl,
      depositInvoiceNumber,
    },
  })
}

/** #10 „Doplatek přijat". */
const onBalancePaid = async ({
  event: { data },
  container,
}: SubscriberArgs<{
  order_id: string
  payment_request_id: string
  amount?: number
  currency_code?: string
}>) => {
  if (!data?.order_id || !data?.payment_request_id) {
    return
  }
  const order = await loadOrder(container, data.order_id)
  if (!order) {
    return
  }

  await sendCustomerEmail(container, {
    template: "payment-received",
    to: order.email,
    key: `balpaid:${data.payment_request_id}`,
    orderId: order.id,
    data: {
      ...common(order),
      paymentAmount: formatMoney(data.amount, data.currency_code),
      paymentMethod: "Doplatek",
    },
  })

  // Doplatková faktura (povinná jako záloha) — teď je doplatek zaplacený.
  // Idempotentní; chyba fakturace nesmí shodit potvrzovací e-mail.
  await ensureMadeToOrderInvoices(container, data.order_id).catch(() => undefined)
}

const isPickupOrder = (order: any): boolean =>
  (order.shipping_methods || []).some(
    (method: any) => method?.data?.personal_pickup === true
  )

/**
 * Dopravce + sledování do e-mailu „předáno dopravci" (docs/sledovani-zasilek.md §3).
 *
 * Číslo zásilky je `order.metadata.cp_label_tracking` (razítko label route);
 * odkaz vede na Track & Trace ČP, ale JEN když číslo je — bez něj e-mail
 * odejde bez tlačítka, nikdy s odkazem do prázdna (§16). Název dopravce
 * podle služby (`NB` Balíkovna / `DR` Do ruky), jinak název dopravní metody.
 * Sdílené pro obě cesty k „odesláno" (změna fáze i nativní shipment), ať
 * zákazník dostane totéž bez ohledu na to, která doběhla první.
 */
const shipmentTracking = (
  order: any,
  fallback?: { number?: string | null; url?: string | null }
) => {
  const method = (order.shipping_methods || [])[0]
  const fromMeta =
    typeof (order.metadata as any)?.cp_label_tracking === "string"
      ? ((order.metadata as any).cp_label_tracking as string).trim()
      : ""
  const trackingNumber = fromMeta || (fallback?.number ?? "")
  return {
    carrierName: cpCarrierName(method?.data?.service_code, method?.name ?? ""),
    trackingNumber,
    trackingLink: fromMeta ? cpTrackingUrl(fromMeta) : (fallback?.url ?? ""),
  }
}

const loadFulfillmentOrder = async (
  container: SubscriberArgs["container"],
  fulfillmentId: string
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: [
      "id",
      "order.id",
      "data",
      "labels.tracking_number",
      "labels.tracking_url",
    ],
    filters: { id: fulfillmentId },
  })
  const fulfillment = fulfillments[0] as any
  const orderId = fulfillment?.order?.id
  if (!orderId) {
    return { fulfillment: null, order: null }
  }
  return { fulfillment, order: await loadOrder(container, orderId) }
}

/**
 * #11 „Objednávka odeslána" — and for personal pickup „Připraveno k vyzvednutí".
 *
 * The tracking CTA is included **only when a tracking number exists**. §16 is
 * explicit: no tracking means the e-mail goes without the button, never with a
 * link that goes nowhere. In record-only carrier mode there is never one.
 *
 * A pickup order's shipment being created means she has packed it — the goods
 * are *ready*, not handed over, so the customer is invited to collect. The
 * handover itself is `delivery.created` below.
 */
const onShipmentCreated = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  if (!data?.id) {
    return
  }
  const { fulfillment, order } = await loadFulfillmentOrder(container, data.id)
  if (!fulfillment || !order) {
    return
  }

  // Osobní odběr: vytvoření zásilky = okamžik vyzvednutí (`completePersonalPickup`
  // podá + odešle naráz). „Připraveno k vyzvednutí" se posílá dřív, při přechodu
  // do „K odeslání" (viz onMerchantStageChanged). Tady už zákazník zboží má →
  // „Objekty jsou u vás".
  if (isPickupOrder(order)) {
    await sendCustomerEmail(container, {
      template: "order-delivered",
      to: order.email,
      key: `ship:${fulfillment.id}`,
      orderId: order.id,
      data: { ...common(order) },
    })
    return
  }

  const label = (fulfillment.labels || [])[0]

  await sendCustomerEmail(container, {
    template: "order-shipment",
    to: order.email,
    // Klíč na OBJEDNÁVKU (ne fulfillment) — sdílený s „Označit jako odeslané"
    // (onMerchantStageChanged fáze shipped), ať zákazník nedostane „odesláno"
    // dvakrát, když se objednávka označí za odeslanou A zároveň vznikne nativní
    // zásilka.
    key: `ship:${order.id}`,
    orderId: order.id,
    data: {
      ...common(order),
      // Číslo z metadat objednávky, jinak ze štítku fulfillmentu; bez obojího
      // odejde e-mail bez řádku dopravce i bez tlačítka — nic se nevymýšlí.
      ...shipmentTracking(order, {
        number: label?.tracking_number,
        url: label?.tracking_url,
      }),
    },
  })
}

/**
 * „Objekty jsou u vás" — sent when the fulfillment is marked as delivered,
 * which for a pickup order is the actual handover. Only pickup orders: a
 * courier delivery is announced by the carrier, and a second mail from us
 * claiming the same thing would be noise (§16).
 */
const onDeliveryCreated = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  if (!data?.id) {
    return
  }
  const { fulfillment, order } = await loadFulfillmentOrder(container, data.id)
  if (!fulfillment || !order || !isPickupOrder(order)) {
    return
  }

  await sendCustomerEmail(container, {
    template: "order-delivered",
    to: order.email,
    key: `deliver:${fulfillment.id}`,
    orderId: order.id,
    data: { ...common(order) },
  })
}

/**
 * #15 „Objednávka zrušena".
 *
 * O penězích mluví jen tehdy, když je refundace OPRAVDU zapsaná
 * (`refund_history`) — šablona dřív slibovala „vrátíme do 3–5 dnů" i u
 * nezaplacené dobírky. Pojistka v `lib/claims/money` navíc zrušení s
 * nevyrovnanými penězi vůbec nepustí, takže zrušená objednávka buď nic
 * neplatila, nebo má vše vrácené.
 */
const onOrderCanceled = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  if (!data?.id) {
    return
  }
  const order = await loadOrder(container, data.id)
  if (!order) {
    return
  }

  const refunded = refundHistoryOf(order).reduce(
    (sum, entry) => sum + toNumber(entry.amount),
    0
  )

  await sendCustomerEmail(container, {
    template: "order-cancelled",
    to: order.email,
    key: `cancel:${order.id}`,
    orderId: order.id,
    data: {
      ...common(order),
      refundRecorded: refunded > 0,
      ...(refunded > 0
        ? { refundAmount: formatMoney(refunded, order.currency_code) }
        : {}),
    },
  })
}

/**
 * #16 „Vracíme peníze".
 *
 * §16 collapses „refund started" and „refund completed" into one mail on
 * purpose: a ComGate refund is a single step, so two e-mails would describe a
 * process that does not exist.
 */
const onPaymentRefunded = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  if (!data?.id) {
    return
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: payments } = await query.graph({
    entity: "payment",
    fields: [
      "id",
      "amount",
      "currency_code",
      "refunds.amount",
      "payment_collection.order.id",
    ],
    filters: { id: data.id },
  })
  const payment = payments[0] as any
  const orderId = payment?.payment_collection?.order?.id
  if (!orderId) {
    return
  }

  const order = await loadOrder(container, orderId)
  if (!order) {
    return
  }

  // Refundace z modulu „Reklamace a zrušení" posílá vlastní e-mail (potvrzení
  // o vyřízení / „vracíme peníze"), a to JEDEN. Modul zapíše stopu do
  // `refund_history` ještě PŘED refundací, takže poslední položka s
  // `return_request_id` a čerstvým časem znamená: tohle je ta refundace, mlč.
  const history = refundHistoryOf(order)
  const last = history[history.length - 1]
  if (last?.return_request_id && last.refunded_at) {
    const age = Date.now() - new Date(last.refunded_at).getTime()
    if (Number.isFinite(age) && Math.abs(age) < 10 * 60 * 1000) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .info(
          `[emails] Přeskakuji payment-refunded pro objednávku ${order.id} — refundace z modulu reklamací (${last.return_request_id}) má vlastní e-mail.`
        )
      return
    }
  }

  const refunded = (payment.refunds || []).reduce(
    (sum: number, refund: any) => sum + toNumber(refund?.amount),
    0
  )

  await sendCustomerEmail(container, {
    template: "payment-refunded",
    to: order.email,
    key: `refund:${payment.id}`,
    orderId: order.id,
    data: {
      ...common(order),
      refundAmount: formatMoney(refunded, payment.currency_code),
      originalPaymentAmount: formatMoney(payment.amount, payment.currency_code),
      refundMethod: "Zpět na účet, ze kterého platba přišla",
      estimatedRefundTime: "Peníze se obvykle vrátí do několika pracovních dnů.",
    },
  })
}

/** #6 „Zadání potvrzeno — začínáme". */
const onSpecificationConfirmed = async ({
  event: { data },
  container,
}: SubscriberArgs<{ order_id: string; production_order_id: string }>) => {
  if (!data?.order_id) {
    return
  }
  const order = await loadOrder(container, data.order_id)
  if (!order) {
    return
  }

  await sendCustomerEmail(container, {
    template: "order-processing",
    to: order.email,
    key: `spec-ok:${data.production_order_id ?? order.id}`,
    orderId: order.id,
    data: {
      ...common(order),
      estimatedProcessingTime:
        "Jakmile bude hotovo, dáme vám vědět a domluvíme se na odeslání.",
    },
  })
}

/**
 * „K zakázce přibyl příplatek" — only ever her click on „Informovat o příplatku".
 * D4 holds: nothing tells the customer about a price change on its own. The
 * per-click `token` makes each deliberate send a real e-mail, while a redelivery
 * of the same event (same token) stays deduped.
 */
const onSurchargeNotified = async ({
  event: { data },
  container,
}: SubscriberArgs<{
  order_id: string
  production_order_id?: string
  surcharge: number
  outstanding: number
  reason?: string | null
  token?: string
}>) => {
  if (!data?.order_id) {
    return
  }
  const order = await loadOrder(container, data.order_id)
  if (!order) {
    return
  }
  await sendCustomerEmail(container, {
    // Písemné potvrzení příplatku dohodnutého jinou cestou (telefon/e-mail) —
    // ne oznámení ceny z čista jasna. Viz `emails/surcharge-confirmed`.
    template: "surcharge-confirmed",
    to: order.email,
    key: `surcharge:${data.production_order_id ?? order.id}:${
      data.token ?? data.surcharge
    }`,
    orderId: order.id,
    data: {
      ...common(order),
      surchargeAmount: formatMoney(data.surcharge, order.currency_code),
      newBalance: formatMoney(data.outstanding, order.currency_code),
      reason: data.reason?.trim() || undefined,
    },
  })
}

/**
 * „Výroba se protáhne" — only ever her click on „Oznámit zpoždění" (the
 * announce_delay admin action). D4 holds: the system never decides a delay
 * on its own, it only delivers the one she announced.
 */
const onDelayAnnounced = async ({
  event: { data },
  container,
}: SubscriberArgs<{
  order_id: string
  production_order_id: string
  original_completion_at?: string | null
  new_completion_at: string
  reason?: string | null
}>) => {
  if (!data?.order_id || !data?.new_completion_at) {
    return
  }
  const order = await loadOrder(container, data.order_id)
  if (!order) {
    return
  }

  await sendCustomerEmail(container, {
    template: "order-delayed",
    to: order.email,
    // Keyed on the new date: announcing the same slip twice sends once, a
    // second slip to a *different* date is genuinely new information.
    key: `delay:${data.production_order_id}:${data.new_completion_at.slice(0, 10)}`,
    orderId: order.id,
    data: {
      ...common(order),
      ...(data.original_completion_at
        ? { originalDeliveryDate: formatDate(data.original_completion_at) }
        : {}),
      newDeliveryDate: formatDate(data.new_completion_at),
      ...(data.reason ? { delayReason: data.reason } : {}),
    },
  })
}

/**
 * „Vrácení schváleno" — hangs off the native return being created. Customers
 * have no self-service returns here; a return exists because she agreed to
 * one with the customer, so its creation *is* the approval, and the e-mail
 * carries the address the objects should travel to.
 */
const onReturnRequested = async ({
  event: { data },
  container,
}: SubscriberArgs<{ order_id: string; return_id: string }>) => {
  if (!data?.order_id || !data?.return_id) {
    return
  }
  const order = await loadOrder(container, data.order_id)
  if (!order) {
    return
  }

  // Pojistka proti dvojímu e-mailu: je-li k objednávce ROZHODNUTÁ žádost z modulu
  // „Vrácení" (ta už poslala vlastní return-approved / return-rejected), nativní
  // Medusa return by poslal druhý. Tehdy tenhle e-mail přeskočíme. Fail-open:
  // když kontrola selže, e-mail raději pošleme (dvojí e-mail < žádný e-mail).
  try {
    const returnRequests = container.resolve<ReturnRequestModuleService>(
      RETURN_REQUEST_MODULE
    )
    const decided = (await returnRequests.listReturnRequests({
      order_id: data.order_id,
      status: ["approved", "received", "resolved", "rejected"],
    } as never)) as any[]
    if (decided.length) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .info(
          `[emails] Přeskakuji nativní return-approved pro objednávku ${data.order_id} — modul Vrácení už rozhodl a e-mail poslal.`
        )
      return
    }
  } catch {
    // Kontrola selhala — e-mail pošleme tak jako tak.
  }

  // Which objects are coming back, by name — return items point at order line
  // items. Best-effort: a return with no resolvable items just omits the row.
  let approvedItems = ""
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: returns } = await query.graph({
      entity: "return",
      // `return_item.quantity` je BigNumber sloupec — číslo i `raw_quantity`
      // (objekt), ať „(N ks)" nezmizí, když přijde objekt (lib/order-quantity).
      fields: ["id", "display_id", "items.item_id", "items.quantity", "items.raw_quantity"],
      filters: { id: data.return_id },
    })
    const returnRow = returns[0] as any
    const byId = new Map(
      (order.items || []).map((item: any) => [item.id, item])
    )
    approvedItems = (returnRow?.items || [])
      .map((returnItem: any) => {
        const item = byId.get(returnItem.item_id) as any
        if (!item) {
          return null
        }
        const quantity = lineQuantityOf(returnItem)
        return quantity > 1
          ? `${item.product_title ?? item.title} (${quantity} ks)`
          : item.product_title ?? item.title
      })
      .filter(Boolean)
      .join(", ")
  } catch {
    // The e-mail is still worth sending without the item list.
  }

  // Adresa pro vrácení z nastavení obchodu (Nastavení → Reklamace), ne natvrdo.
  const settings = await getMerchantSettings(container).catch(() => null)

  await sendCustomerEmail(container, {
    template: "return-approved",
    to: order.email,
    key: `return-approved:${data.return_id}`,
    orderId: order.id,
    data: {
      ...common(order),
      ...(approvedItems ? { approvedItems } : {}),
      resolution: "refund",
      goodsReturnRequired: true,
      returnMethod: "Zásilka na adresu ateliéru",
      returnAddress:
        settings?.return_address || "Keramická zahrada\nPutim 229\n397 01 Písek",
      ...(settings?.return_instructions?.trim()
        ? { returnInstructions: settings.return_instructions.trim() }
        : {}),
    },
  })
}

/**
 * „Objednávka je připravená k odeslání" — merchant přesune objednávku do fáze
 * „K odeslání" (zabaleno, čeká na předání dopravci). Mezikrok mezi potvrzením a
 * odesláním, který u běžného zboží chyběl. NEposílá se u:
 *  - osobního odběru (má „k vyzvednutí" na shipment.created);
 *  - čistě zakázkové objednávky (má „zakázka hotová" na dokončení výroby) —
 *    jinak by u ní přišel generický „připraveno" i „hotová".
 * U smíšené (produkty + zakázka) se pošle normálně, vedle zakázkových e-mailů.
 */
const onMerchantStageChanged = async ({
  event: { data },
  container,
}: SubscriberArgs<{ order_id: string; stage: string }>) => {
  if (
    (data?.stage !== "shipping" &&
      data?.stage !== "working" &&
      data?.stage !== "shipped") ||
    !data?.order_id
  ) {
    return
  }
  const order = await loadOrder(container, data.order_id)
  if (!order) {
    return
  }

  // „Připravujeme" — běžná skladová objednávka vstoupila do fáze „working"
  // (merchantská fáze s popiskem „Připravujeme", zabalení před předáním).
  // Mezikrok mezi potvrzením a „připraveno k odeslání", který u běžného zboží
  // chyběl.
  if (data.stage === "working") {
    // Čistě zakázková objednávka má „začínáme" přes onSpecificationConfirmed
    // (potvrzení zadání ji taky posune do „working"); generický „připravujeme"
    // by u ní byl matoucí a dubloval by. Posíláme jen, je-li ve hře běžné zboží.
    const items = (order.items || []) as any[]
    const pureCommission =
      items.length > 0 &&
      items.every((item: any) => Boolean((item?.metadata as any)?.made_to_order))
    if (pureCommission) {
      return
    }

    await sendCustomerEmail(container, {
      template: "order-preparing",
      to: order.email,
      // At-least-once: klíč na objednávku, ať návrat do „Připravujeme"
      // (např. z „payment_problem") neposílá znovu.
      key: `working:${order.id}`,
      orderId: order.id,
      data: { ...common(order) },
    })
    return
  }

  // „Označit jako odeslané" (fáze → shipped) = e-mail „odesláno" zákazníkovi.
  // „Odesláno" je teď lehká akce (jen stav + e-mail, bez Medusa zásilky/štítku),
  // takže e-mail visí na změně fáze, ne na shipment.created. Osobní odběr
  // přeskakujeme — ten má vlastní tok (připraveno k vyzvednutí / máte u sebe).
  // Dedupe klíč `ship:${order.id}` je SDÍLENÝ s onShipmentCreated, takže pozdní
  // nativní zásilka nepošle „odesláno" podruhé.
  if (data.stage === "shipped") {
    if (isPickupOrder(order)) {
      return
    }
    // Odkaz „Sledovat zásilku" na Track & Trace ČP — jen když číslo zásilky
    // existuje (štítek); sledování zásilek na něj navazuje (sledovani-zasilek.md §3).
    await sendCustomerEmail(container, {
      template: "order-shipment",
      to: order.email,
      key: `ship:${order.id}`,
      orderId: order.id,
      data: {
        ...common(order),
        ...shipmentTracking(order),
      },
    })
    return
  }

  // Osobní odběr má vlastní e-mail „připraveno k vyzvednutí" (zákazník si má
  // přijít). Posílá se právě tady, ve chvíli, kdy je objednávka připravená —
  // ne až při vyzvednutí. (Při vyzvednutí jde „máte u sebe", viz onShipmentCreated.)
  if (isPickupOrder(order)) {
    await sendCustomerEmail(container, {
      template: "order-ready-pickup",
      to: order.email,
      key: `ready-pickup:${order.id}`,
      orderId: order.id,
      data: {
        ...common(order),
        pickupLocation: "Ateliér Keramická zahrada",
        pickupAddress: "Putim 229, 397 01 Písek",
        readyDate: new Date().toLocaleDateString("cs-CZ"),
      },
    })
    return
  }

  // Čistě zakázková objednávka má „připraveno" = „zakázka hotová"; generický
  // e-mail by u ní dubloval. Posíláme jen když je ve hře i běžné zboží.
  const items = (order.items || []) as any[]
  const pureCommission =
    items.length > 0 &&
    items.every((item: any) => Boolean((item?.metadata as any)?.made_to_order))
  if (pureCommission) {
    return
  }

  await sendCustomerEmail(container, {
    template: "order-ready",
    to: order.email,
    // At-least-once: klíč na objednávku, ať návrat do „K odeslání" neposílá znovu.
    key: `ready:${order.id}`,
    orderId: order.id,
    data: { ...common(order) },
  })
}

/**
 * „Vaše zakázka je hotová" — dokončení výroby na zakázku (complete_production).
 * Doplatek zůstává RUČNÍ (tlačítko); u nezaplaceného zůstatku e-mail napoví, že
 * výzva k doplacení přijde. Přiloží nejnovější sdílenou fotku, pokud nějaká je.
 */
const onProductionCompleted = async ({
  event: { data },
  container,
}: SubscriberArgs<{
  order_id: string
  production_order_id?: string
  fully_paid?: boolean
  outstanding?: number
}>) => {
  if (!data?.order_id) {
    return
  }
  const order = await loadOrder(container, data.order_id)
  if (!order) {
    return
  }

  const fullyPaid = data.fully_paid !== false
  const outstanding =
    typeof data.outstanding === "number" ? data.outstanding : 0

  await sendCustomerEmail(container, {
    template: "commission-completed",
    to: order.email,
    key: `mto-done:${data.production_order_id ?? order.id}`,
    orderId: order.id,
    data: {
      ...common(order),
      fullyPaid,
      balanceDue:
        !fullyPaid && outstanding > 0
          ? formatMoney(outstanding, order.currency_code)
          : null,
      // Obrázek objednaného produktu zakázky (ne fotka od zákazníka).
      makingPhotoUrl: commissionProductImage(order),
    },
  })
}

const handlers: Record<string, (args: SubscriberArgs<any>) => Promise<void>> = {
  "payment.captured": onPaymentCaptured,
  "made-to-order.balance-requested": onBalanceRequested,
  "made-to-order.balance-paid": onBalancePaid,
  "made-to-order.specification-confirmed": onSpecificationConfirmed,
  "made-to-order.production-completed": onProductionCompleted,
  "made-to-order.surcharge-notified": onSurchargeNotified,
  "made-to-order.delay-announced": onDelayAnnounced,
  "merchant-order.stage-changed": onMerchantStageChanged,
  "shipment.created": onShipmentCreated,
  "delivery.created": onDeliveryCreated,
  "order.canceled": onOrderCanceled,
  "order.return_requested": onReturnRequested,
  "payment.refunded": onPaymentRefunded,
}

export default async function customerEmails(args: SubscriberArgs<any>) {
  const handler = handlers[args.event.name]
  if (handler) {
    await handler(args)
  }
}

export const config: SubscriberConfig = {
  event: [
    "payment.captured",
    "made-to-order.balance-requested",
    "made-to-order.balance-paid",
    "made-to-order.specification-confirmed",
    "made-to-order.production-completed",
    "made-to-order.surcharge-notified",
    "made-to-order.delay-announced",
    "merchant-order.stage-changed",
    "shipment.created",
    "delivery.created",
    "order.canceled",
    "order.return_requested",
    "payment.refunded",
  ],
}
