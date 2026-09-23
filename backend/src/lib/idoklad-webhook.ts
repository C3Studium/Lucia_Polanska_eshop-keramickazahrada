/**
 * iDoklad v3 webhook parsing and verification — the pure half of
 * `/hooks/idoklad` (the HTTP half lives in `api/hooks/idoklad/route.ts`).
 *
 * ## What iDoklad sends — and what we assume
 *
 * iDoklad API v3 webhooks are registered in iDoklad (Developer portal /
 * Nastavení → API) with a target URL; each registration gets a **PublicId**
 * (a GUID) that iDoklad includes in every delivery. There is no HMAC
 * signature, so the PublicId is the whole proof of origin: it must match the
 * `IDOKLAD_WEBHOOK_PUBLIC_ID` env (compared constant-time) or the request is
 * rejected as not-from-iDoklad.
 *
 * Event identification, per the handover and the v3 enums:
 *
 * - **EntityType 0 = IssuedInvoice** (faktura vydaná)
 * - **ActionType 4 = the "paid" action** (úhrada faktury)
 *
 * We filter on exactly that pair, tolerating the textual enum names
 * (`"IssuedInvoice"`, `"Paid"`/`"Pay"`) in case iDoklad serializes enums as
 * strings. Everything else is acknowledged with 200 and skipped — a retry of
 * an event type we do not handle would never start handling it.
 *
 * The delivery shape is tolerated in three variants (documented assumption —
 * iDoklad's docs show a flat event object; wrappers are accepted defensively):
 *
 * 1. one event object: `{ PublicId, EntityType, ActionType, EntityId }`
 * 2. an array of such objects
 * 3. a wrapper: `{ PublicId, Events|Items|Data: [ ...event objects ] }`
 *    (the wrapper's PublicId is inherited by events that carry none)
 *
 * The event's `EntityId` is the issued invoice id — the same number stamped
 * on the order as `metadata.idoklad_invoice_id` when the invoice was issued.
 */

import { createHash, timingSafeEqual } from "crypto"

/**
 * Constant-time PublicId comparison. Hashing first makes the lengths equal,
 * so `timingSafeEqual` is usable and the comparison leaks nothing about how
 * many leading characters matched. GUID casing is normalized away.
 */
export const publicIdMatches = (
  provided: unknown,
  expected: string | undefined | null
): boolean => {
  if (typeof provided !== "string" || !provided.trim()) {
    return false
  }
  if (typeof expected !== "string" || !expected.trim()) {
    return false
  }
  const digest = (value: string) =>
    createHash("sha256").update(value.trim().toLowerCase()).digest()
  return timingSafeEqual(digest(provided), digest(expected))
}

export type IdokladWebhookEvent = {
  entity: unknown
  action: unknown
  entity_id: number | null
  public_id: string | null
}

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length ? value.trim() : null

const asPositiveInt = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null
}

const readEvent = (
  raw: Record<string, unknown>,
  inheritedPublicId: string | null
): IdokladWebhookEvent => ({
  entity: raw.EntityType ?? raw.entityType ?? raw.Entity ?? null,
  action: raw.ActionType ?? raw.actionType ?? raw.Action ?? null,
  entity_id: asPositiveInt(raw.EntityId ?? raw.entityId ?? raw.Id ?? raw.id),
  public_id:
    asString(raw.PublicId ?? raw.publicId ?? raw.WebhookPublicId) ??
    inheritedPublicId,
})

/** Tolerant extraction of the three delivery shapes described above. */
export const extractIdokladEvents = (body: unknown): IdokladWebhookEvent[] => {
  if (!body || typeof body !== "object") {
    return []
  }

  if (Array.isArray(body)) {
    return body
      .filter((item) => item && typeof item === "object")
      .map((item) => readEvent(item as Record<string, unknown>, null))
  }

  const record = body as Record<string, unknown>
  const wrapperPublicId = asString(
    record.PublicId ?? record.publicId ?? record.WebhookPublicId
  )

  for (const key of ["Events", "Items", "Data", "events", "items", "data"]) {
    const nested = record[key]
    if (Array.isArray(nested)) {
      return nested
        .filter((item) => item && typeof item === "object")
        .map((item) => readEvent(item as Record<string, unknown>, wrapperPublicId))
    }
  }

  return [readEvent(record, wrapperPublicId)]
}

/** EntityType 0 / "IssuedInvoice". */
export const isIssuedInvoiceEntity = (entity: unknown): boolean => {
  if (entity === 0 || entity === "0") {
    return true
  }
  return typeof entity === "string" && /^issuedinvoice$/i.test(entity.trim())
}

/** ActionType 4 / "Paid" / "Pay" — the invoice-paid action class. */
export const isPaidAction = (action: unknown): boolean => {
  if (action === 4 || action === "4") {
    return true
  }
  return typeof action === "string" && /^(paid|pay|fullypaid)$/i.test(action.trim())
}

export const isInvoicePaidEvent = (event: IdokladWebhookEvent): boolean =>
  isIssuedInvoiceEntity(event.entity) &&
  isPaidAction(event.action) &&
  event.entity_id !== null
