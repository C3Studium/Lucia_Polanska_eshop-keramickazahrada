import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { sendCustomerEmail } from "../../../lib/customer-email"
import {
  newsletterConfirmUrl,
  normalizeEmail,
} from "../../../lib/newsletter-link"
import { NEWSLETTER_MODULE } from "../../../modules/newsletter"
import type NewsletterModuleService from "../../../modules/newsletter/service"
import { PostStoreNewsletterSchema } from "./validators"

type PostStoreNewsletter = z.infer<typeof PostStoreNewsletterSchema>

/*
 * A small sliding window over the whole route, mirroring the contact form's
 * in-memory limiter (`api/store/contact/route.ts`). The per-address guards
 * (upsert by e-mail, confirm mail keyed per day) already stop repeats of one
 * address — what they cannot stop is a script inventing a fresh address per
 * request, each one a new pending row and a new confirmation e-mail sent to
 * a stranger. A ceramics atelier does not sign up thirty people in ten
 * minutes; a script does. In-memory on purpose — a second instance grants a
 * second window, which is an acceptable failure for a signup form.
 */
const WINDOW_MS = 10 * 60 * 1000
const WINDOW_LIMIT = 30
let windowHits: number[] = []

const withinLimit = (now: number): boolean => {
  windowHits = windowHits.filter((stamp) => now - stamp < WINDOW_MS)
  if (windowHits.length >= WINDOW_LIMIT) {
    return false
  }
  windowHits.push(now)
  return true
}

/**
 * The footer form: „Zůstaňte blízko ateliéru." — first half of double opt-in.
 *
 * Signing up stores the address as *pending* (`confirmed_at: null`) and sends
 * a confirmation e-mail with a signed link (`GET /newsletter/confirm`). Only
 * that click makes the address a campaign recipient — zák. č. 480/2004 Sb.
 * wants consent the sender can prove, and the click is the proof. The row
 * itself is the evidence: `subscribed_at` (when), `source` (where),
 * `confirmed_at` (proof).
 *
 * Upsert by address, and the response is `{ ok: true }` in every case, so the
 * endpoint cannot be used to probe which addresses are on the list:
 *
 * - brand-new address → pending row + confirm e-mail,
 * - previously unsubscribed → pending again (their old confirmation predates
 *   their unsubscribe, so consent is asked for afresh) + confirm e-mail,
 * - pending and impatient → confirm e-mail again (keyed per day, so a
 *   double-click cannot double the inbox),
 * - already confirmed → nothing; there is nothing to confirm.
 *
 * If BACKEND_PUBLIC_URL/MEDUSA_BACKEND_URL is unset the confirm link cannot
 * be built. Then the e-mail is *not* sent — a confirmation request whose
 * button leads nowhere would strand the subscriber — the row stays pending,
 * and the admin's Newsletter page shows the misconfiguration.
 */
export async function POST(req: MedusaRequest<PostStoreNewsletter>, res: MedusaResponse) {
  const body = (req.validatedBody || req.body) as PostStoreNewsletter
  const rawEmail = typeof body?.email === "string" ? body.email : ""
  const email = normalizeEmail(rawEmail)

  // Belt and braces beside the middleware validator: this route must never
  // store an unusable address.
  if (!z.string().email().safeParse(email).success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A valid e-mail address is required."
    )
  }

  if (!withinLimit(Date.now())) {
    res.status(429).json({
      message:
        "Přihlášek k odběru přišlo příliš mnoho krátce po sobě. Zkuste to prosím za chvíli.",
    })
    return
  }

  const newsletter = req.scope.resolve<NewsletterModuleService>(
    NEWSLETTER_MODULE
  )

  const [existing] = await newsletter.listNewsletterSubscribers(
    { email } as never
  )

  let shouldAskToConfirm = false

  if (!existing) {
    await newsletter.createNewsletterSubscribers({
      email,
      source: "storefront",
      subscribed_at: new Date(),
      confirmed_at: null,
      unsubscribed_at: null,
    } as never)
    shouldAskToConfirm = true
  } else if (existing.unsubscribed_at) {
    await newsletter.updateNewsletterSubscribers({
      id: existing.id,
      subscribed_at: new Date(),
      confirmed_at: null,
      unsubscribed_at: null,
      // A fresh, deliberate signup wipes the slate — including an automatic
      // „nedoručitelné"/spam suppression. If the mailbox is still dead, the
      // next delivery report will suppress it again on its own.
      suppressed_reason: null,
    } as never)
    shouldAskToConfirm = true
  } else if (!existing.confirmed_at) {
    // Still pending — most likely the first e-mail went missing. Ask again.
    shouldAskToConfirm = true
  }

  if (shouldAskToConfirm) {
    const confirmLink = newsletterConfirmUrl(email)

    if (!confirmLink) {
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .error(
          `[newsletter] BACKEND_PUBLIC_URL/MEDUSA_BACKEND_URL není nastaveno — potvrzovací e-mail nelze poslat a odběratel zůstane ve stavu „čeká na potvrzení".`
        )
    } else {
      const day = new Date().toISOString().slice(0, 10)

      /* A mail-provider hiccup must not turn a recorded signup into a 500 —
         the row is saved (pending); log loudly and answer as usual. The
         per-day key means a next-day retry sends a fresh confirm mail. */
      await sendCustomerEmail(req.scope, {
        template: "newsletter-signup",
        to: email,
        key: `nl-confirm:${email}:${day}`,
        data: {
          subject: "Potvrďte odběr novinek z ateliéru",
          confirmLink,
        },
      }).catch((error) =>
        req.scope
          .resolve(ContainerRegistrationKeys.LOGGER)
          .error(
            `[newsletter] Potvrzovací e-mail pro ${email} se nepodařilo odeslat: ${
              error instanceof Error ? error.message : "neznámá chyba"
            }`
          )
      )
    }
  }

  res.json({ ok: true })
}
