import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendCustomerEmail, storefrontBase } from "../../../lib/customer-email"
import {
  normalizeEmail,
  verifyUnsubscribeToken,
} from "../../../lib/newsletter-link"
import { NEWSLETTER_MODULE } from "../../../modules/newsletter"
import type NewsletterModuleService from "../../../modules/newsletter/service"

/**
 * „Odhlásit se" — the link in every newsletter's footer.
 *
 * A mail client can only issue a plain GET with no credentials, so the link
 * carries a signed token instead (`lib/newsletter-link.ts`). That is also why
 * this route lives at the *top level* rather than under `/store`: Medusa
 * applies the publishable-key middleware to the entire `/store` namespace with
 * no per-route exemption, and a mail client sends no headers at all. (The
 * same handler is re-exported at `/store/newsletter/unsubscribe` for callers
 * that do carry the key.)
 *
 * A GET with a side effect is a deliberate trade: it is the only shape an
 * e-mail link can have, and the effect is idempotent — unsubscribing twice is
 * still unsubscribed, so a prefetching mail client or a triple-click all land
 * in the same place.
 *
 * Failures redirect to the storefront with a reason rather than rendering an
 * API error at somebody who was just trying to say „už ne, děkuji".
 */

const FALLBACK_TEXT: Record<string, string> = {
  odhlaseno:
    "Odhlášení proběhlo. Žádné další zprávy z ateliéru už vám chodit nebudou.",
  "neplatny-odkaz": "Odkaz pro odhlášení není platný. Napište nám prosím.",
  chyba: "Odhlášení se nepodařilo dokončit. Napište nám prosím.",
}

const bounce = (res: MedusaResponse, status: string) => {
  const base = storefrontBase()
  if (!base) {
    // No storefront configured — say it in the customer's language rather
    // than leaving a blank page.
    res.status(200).send(FALLBACK_TEXT[status] ?? FALLBACK_TEXT.chyba)
    return
  }
  res.redirect(302, `${base}?newsletter=${status}`)
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const email = normalizeEmail(
    typeof req.query.email === "string" ? req.query.email : ""
  )

  if (!email || !verifyUnsubscribeToken(email, req.query.token)) {
    // Deliberately vague: a precise message would help someone probing tokens.
    bounce(res, "neplatny-odkaz")
    return
  }

  try {
    const newsletter = req.scope.resolve<NewsletterModuleService>(
      NEWSLETTER_MODULE
    )

    const [subscriber] = await newsletter.listNewsletterSubscribers(
      { email } as never
    )

    // Unknown address or already unsubscribed: nothing to change and no
    // confirmation to send — but the person's intent is satisfied, so the
    // page says so instead of arguing.
    if (subscriber && !subscriber.unsubscribed_at) {
      await newsletter.updateNewsletterSubscribers({
        id: subscriber.id,
        unsubscribed_at: new Date(),
      } as never)

      const day = new Date().toISOString().slice(0, 10)
      await sendCustomerEmail(req.scope, {
        template: "newsletter-unsubscribe",
        to: email,
        key: `nl-unsub:${email}:${day}`,
        data: { email },
      })
    }

    bounce(res, "odhlaseno")
  } catch (error) {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `[newsletter] Odhlášení adresy ${email} se nepodařilo: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    bounce(res, "chyba")
  }
}
