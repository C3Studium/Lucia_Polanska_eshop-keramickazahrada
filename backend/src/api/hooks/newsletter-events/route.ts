import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  extractCampaignTag,
  extractClickUrl,
  extractRecipientEmail,
  mapResendEventType,
  recordNewsletterEvent,
  suppressionReasonFor,
  verifySvixSignature,
  type NewsletterEventStore,
} from "../../../lib/newsletter-events"
import { NEWSLETTER_MODULE } from "../../../modules/newsletter"
import type NewsletterModuleService from "../../../modules/newsletter/service"

/**
 * Delivery reports from the mail service (Resend webhooks, Svix-signed).
 *
 * Public by construction — Resend's servers hold no credentials of ours —
 * so *every* request must prove itself with the Svix signature
 * (`lib/newsletter-events.ts#verifySvixSignature`) over the raw body.
 * Medusa preserves `req.rawBody` for `/hooks/*` routes, which is exactly
 * why this endpoint lives here rather than under `/admin` or `/store`.
 *
 * Response contract, per the webhook queue's retry semantics:
 * - 503 — secret not configured; nothing can be verified, try again later.
 * - 401 — signature missing/wrong/stale; not from the mail service.
 * - 200 — verified. Unknown event types are logged and skipped (still 200 —
 *   a retry would not make the type known), duplicates are acknowledged
 *   without counting twice.
 * - 500 — a real processing error; the queue should retry.
 *
 * What a verified report does: one row in `newsletter_event` (dedupe-keyed),
 * and for hard bounces / spam complaints the automatic unsubscribe with
 * `suppressed_reason` — see `lib/newsletter-events.ts`.
 */

let warnedMissingSecret = false

const headerValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true
      logger.warn(
        "[newsletter] RESEND_WEBHOOK_SECRET není nastaven — hlášení o doručení newsletterů se zatím nepřijímají a statistiky kampaní zůstanou prázdné."
      )
    }
    res.status(503).json({ ok: false })
    return
  }

  const rawBody = Buffer.isBuffer(req.rawBody)
    ? req.rawBody.toString("utf8")
    : typeof req.rawBody === "string"
      ? req.rawBody
      : JSON.stringify(req.body ?? {})

  const svixId = headerValue(req.headers["svix-id"])
  const verification = verifySvixSignature({
    secret,
    id: svixId,
    timestamp: headerValue(req.headers["svix-timestamp"]),
    signature: headerValue(req.headers["svix-signature"]),
    payload: rawBody,
  })

  if (!verification.ok) {
    logger.warn(
      `[newsletter] Odmítnuto hlášení o doručení bez platného podpisu (${verification.reason}).`
    )
    res.status(401).json({ ok: false })
    return
  }

  try {
    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      // Signed, yet unparseable — nothing to record, nothing a retry fixes.
      logger.warn("[newsletter] Podepsané hlášení o doručení nešlo přečíst — přeskočeno.")
      res.status(200).json({ received: true })
      return
    }

    const type = mapResendEventType(body.type)
    if (!type) {
      logger.info(
        `[newsletter] Hlášení typu „${String(body.type)}" se nesleduje — přeskočeno.`
      )
      res.status(200).json({ received: true })
      return
    }

    const email = extractRecipientEmail(body.data)
    if (!email || !svixId) {
      logger.warn(
        `[newsletter] Hlášení „${String(body.type)}" bez adresy příjemce — přeskočeno.`
      )
      res.status(200).json({ received: true })
      return
    }

    const newsletter = req.scope.resolve<NewsletterModuleService>(
      NEWSLETTER_MODULE
    ) as unknown as NewsletterEventStore

    const result = await recordNewsletterEvent(newsletter, {
      svixId,
      type,
      email,
      url: type === "clicked" ? extractClickUrl(body.data) : null,
      tagValue: extractCampaignTag(body.data),
      suppressReason: suppressionReasonFor(type, body.data),
    })

    if (result.suppressed) {
      logger.info(
        `[newsletter] Adresa ${email} vyřazena z odběru (${
          result.suppressed === "bounce"
            ? "trvale nedoručitelná"
            : "označila zprávu jako spam"
        }).`
      )
    }

    res.status(200).json({ received: true })
  } catch (error) {
    logger.error(
      `[newsletter] Hlášení o doručení se nepodařilo zpracovat: ${
        error instanceof Error ? error.message : "neznámá chyba"
      }`
    )
    res.status(500).json({ ok: false })
  }
}
