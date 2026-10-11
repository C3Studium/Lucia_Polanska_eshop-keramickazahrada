/**
 * iDoklad v3 webhook parsing and verification — the pure half of
 * `/hooks/idoklad` (the HTTP half lives in `api/hooks/idoklad/route.ts`).
 *
 * ## What iDoklad really sends (api.idoklad.cz/Help/v3/cs, „Webhooky")
 *
 * Ověřeno 11. 10. 2026 z dokumentace API a z oficiálního SDK (Solitea/IdokladSdk).
 * Původní verze téhle routy stála na domněnce, že iDoklad posílá v těle
 * `PublicId` a nic nepodepisuje — obojí bylo špatně a iDoklad by od nás
 * dostal 401 na každé hlášení.
 *
 * - **Registrace má dvě části.** Webhook (cílová URL + secret token) se
 *   zakládá v Developer portálu (developer.idoklad.cz) a dostane tam
 *   **PublicId** (GUID). Agenda se k němu pak přihlásí přes API:
 *   `POST /v3/Webhooks { PublicId, EntityType, ActionType }`
 *   (viz `api/admin/idoklad/webhooks/route.ts`).
 * - **Tělo doručení:**
 *   `{ "DeliveryId": "<guid>", "Events": [ { "AgendaId", "EntityId",
 *   "EntityType": "IssuedInvoice", "EventDate", "EventType": "PaymentCreated" } ] }`
 *   — typy jsou TEXTOVÉ názvy výčtů, `PublicId` v těle NENÍ.
 * - **Podpis:** hlavička `X-idoklad-signature: sha256=<HEX>`, kde HEX je
 *   HMAC-SHA256 nad surovým tělem (UTF-8) s klíčem = secret token webhooku
 *   (UTF-8 bajty). Jediný důkaz původu — env `IDOKLAD_WEBHOOK_SECRET`.
 * - Odesílá se z IP 48.209.158.56 (jen pro logy; neověřujeme, Railway proxy
 *   skutečnou IP nezaručí a podpis stačí).
 *
 * Číselné výčty (`EntityType 0`, `ActionType 4`) se tolerují taky — takhle
 * je zná registrační endpoint, a kdyby je iDoklad někdy poslal i v doručení,
 * nemá to rozbít párování.
 *
 * - **EntityType 0 / "IssuedInvoice"** — faktura vydaná
 * - **ActionType 4 / "PaymentCreated"** — k dokladu vznikla úhrada (i
 *   částečná! — proto route před zápisem ověří `PaymentStatus` faktury)
 */

import { createHmac, timingSafeEqual } from "crypto"

/** Záhlaví, ve kterém iDoklad posílá podpis (Node ho má malými písmeny). */
export const IDOKLAD_SIGNATURE_HEADER = "x-idoklad-signature"

/** Výčty pro registraci (`POST /v3/Webhooks`) — číselně, jak je API chce. */
export const IDOKLAD_WEBHOOK_ENTITY_ISSUED_INVOICE = 0
export const IDOKLAD_WEBHOOK_ACTION_PAYMENT_CREATED = 4

/**
 * Ověří `X-idoklad-signature` proti surovému tělu.
 *
 * Přesně podle ukázky v dokumentaci (C# `VerifySignature`): rozdělit
 * záhlaví na `sha256` a hex, spočítat HMAC-SHA256(UTF-8 secret, UTF-8 tělo)
 * a porovnat bajty. Porovnání v konstantním čase; hex může přijít velkými
 * i malými písmeny (dokumentace ukazuje velká).
 *
 * Pozor: podpis platí jen nad PŮVODNÍMI bajty těla. Proto route žádá
 * `preserveRawBody` (middlewares.ts) — přeserializovaný `req.body` by se
 * v mezerách lišil a podpis by nikdy neseděl.
 */
export const verifyIdokladSignature = (input: {
  secret: string | undefined | null
  header: string | string[] | undefined | null
  payload: string | Buffer
}): boolean => {
  const secret = typeof input.secret === "string" ? input.secret : ""
  if (!secret) {
    return false
  }

  const header = Array.isArray(input.header) ? input.header[0] : input.header
  if (typeof header !== "string") {
    return false
  }
  const match = header.trim().match(/^sha256=([0-9a-fA-F]{64})$/)
  if (!match) {
    return false
  }

  const provided = Buffer.from(match[1], "hex")
  const expected = createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(
      Buffer.isBuffer(input.payload)
        ? input.payload
        : Buffer.from(input.payload, "utf8")
    )
    .digest()

  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

/** Podpis pro testy a pro ruční zkušební doručení (`sha256=<HEX>`). */
export const signIdokladPayload = (secret: string, payload: string): string =>
  `sha256=${createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(Buffer.from(payload, "utf8"))
    .digest("hex")
    .toUpperCase()}`

export type IdokladWebhookEvent = {
  entity: unknown
  action: unknown
  entity_id: number | null
  agenda_id: number | null
  event_date: string | null
}

export type IdokladWebhookDelivery = {
  delivery_id: string | null
  events: IdokladWebhookEvent[]
}

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length ? value.trim() : null

const asPositiveInt = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null
}

const readEvent = (raw: Record<string, unknown>): IdokladWebhookEvent => ({
  entity: raw.EntityType ?? raw.entityType ?? null,
  // Dokumentovaný název je `EventType`; `ActionType` je název z registrace.
  action: raw.EventType ?? raw.eventType ?? raw.ActionType ?? raw.actionType ?? null,
  entity_id: asPositiveInt(raw.EntityId ?? raw.entityId),
  agenda_id: asPositiveInt(raw.AgendaId ?? raw.agendaId),
  event_date: asString(raw.EventDate ?? raw.eventDate),
})

/**
 * Události z doručení. Dokumentovaný tvar je obálka `{ DeliveryId, Events }`;
 * samotný objekt události nebo pole událostí se snesou taky (nic nestojí a
 * chrání před drobnou změnou formátu).
 */
export const extractIdokladDelivery = (body: unknown): IdokladWebhookDelivery => {
  if (!body || typeof body !== "object") {
    return { delivery_id: null, events: [] }
  }

  const toEvents = (items: unknown[]) =>
    items
      .filter((item) => item && typeof item === "object")
      .map((item) => readEvent(item as Record<string, unknown>))

  if (Array.isArray(body)) {
    return { delivery_id: null, events: toEvents(body) }
  }

  const record = body as Record<string, unknown>
  const deliveryId = asString(record.DeliveryId ?? record.deliveryId)
  const nested = record.Events ?? record.events
  if (Array.isArray(nested)) {
    return { delivery_id: deliveryId, events: toEvents(nested) }
  }

  // Jednotlivá událost bez obálky — jen když opravdu vypadá jako událost.
  if ("EntityType" in record || "EventType" in record || "EntityId" in record) {
    return { delivery_id: deliveryId, events: [readEvent(record)] }
  }
  return { delivery_id: deliveryId, events: [] }
}

/** EntityType 0 / "IssuedInvoice". */
export const isIssuedInvoiceEntity = (entity: unknown): boolean => {
  if (entity === IDOKLAD_WEBHOOK_ENTITY_ISSUED_INVOICE || entity === "0") {
    return true
  }
  return typeof entity === "string" && /^issuedinvoice$/i.test(entity.trim())
}

/** ActionType 4 / "PaymentCreated" — k dokladu vznikla úhrada. */
export const isPaymentCreatedAction = (action: unknown): boolean => {
  if (action === IDOKLAD_WEBHOOK_ACTION_PAYMENT_CREATED || action === "4") {
    return true
  }
  return typeof action === "string" && /^paymentcreated$/i.test(action.trim())
}

export const isInvoicePaymentEvent = (event: IdokladWebhookEvent): boolean =>
  isIssuedInvoiceEntity(event.entity) &&
  isPaymentCreatedAction(event.action) &&
  event.entity_id !== null

/**
 * Je faktura v iDokladu uhrazená CELÁ? `PaymentCreated` chodí i na částečnou
 * úhradu — dobírka se ale zapisuje jen celá (stejně jako tlačítko „Peníze
 * přišly"), takže částečná platba jde majitelce k posouzení, ne do účetnictví.
 *
 * PaymentStatus: 0 Unpaid, 1 Paid, 2 PartialPaid, 3 Overpaid (SDK `PaymentStatus`).
 */
export type InvoicePaymentVerdict = "paid" | "partial" | "unpaid"

export const invoicePaymentVerdict = (invoice: {
  PaymentStatus?: unknown
} | null | undefined): InvoicePaymentVerdict => {
  const status = Number(invoice?.PaymentStatus)
  if (status === 1 || status === 3) {
    return "paid"
  }
  if (status === 2) {
    return "partial"
  }
  return "unpaid"
}
