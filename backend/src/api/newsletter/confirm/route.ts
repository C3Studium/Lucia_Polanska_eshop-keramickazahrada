import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { storefrontBase } from "../../../lib/customer-email"
import {
  normalizeEmail,
  verifyConfirmToken,
} from "../../../lib/newsletter-link"
import { NEWSLETTER_MODULE } from "../../../modules/newsletter"
import type NewsletterModuleService from "../../../modules/newsletter/service"

/**
 * „Potvrdit odběr" — the button in the double-opt-in e-mail.
 *
 * The second half of double opt-in: the click proves the mailbox owner wants
 * the newsletter, so this handler stamps `confirmed_at` — the consent
 * evidence campaigns check before sending (zák. č. 480/2004 Sb.).
 *
 * Same shape as `../unsubscribe`: a mail client can only issue a plain GET
 * with no credentials, so the link carries a signed token
 * (`lib/newsletter-link.ts`), and the route lives at the *top level* because
 * the whole `/store` namespace demands a publishable key no mail client
 * sends. The side effect is idempotent — confirming twice is still
 * confirmed — so a prefetching mail client or a triple-click land in the
 * same place.
 *
 * One deliberate refusal: a confirm link does NOT override a *later*
 * unsubscribe. Old confirmation e-mails survive in inboxes for years, and a
 * link that silently re-subscribed someone who already left would be the
 * exact dark pattern this flow exists to prevent. They are told to sign up
 * again instead.
 *
 * The person lands on the storefront's `/newsletter?stav=…` page; when no
 * storefront is configured, plain Czech text renders rather than a blank
 * page.
 */

const FALLBACK_TEXT: Record<string, string> = {
  potvrzeno:
    "Odběr je potvrzený. Ozveme se, až bude co říct — a jinak mlčíme.",
  "jiz-odhlaseno":
    "Tento e-mail je z odběru odhlášený. Pokud chcete novinky znovu, přihlaste se prosím ve formuláři na webu.",
  "neplatny-odkaz": "Odkaz pro potvrzení není platný. Napište nám prosím.",
  chyba: "Potvrzení se nepodařilo dokončit. Napište nám prosím.",
}

const bounce = (res: MedusaResponse, status: string) => {
  const base = storefrontBase()
  if (!base) {
    res.status(200).send(FALLBACK_TEXT[status] ?? FALLBACK_TEXT.chyba)
    return
  }
  res.redirect(302, `${base}/newsletter?stav=${status}`)
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const email = normalizeEmail(
    typeof req.query.email === "string" ? req.query.email : ""
  )

  if (!email || !verifyConfirmToken(email, req.query.token)) {
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

    if (!subscriber) {
      // A signed token for an address that was never stored — the row was
      // removed, or the link outlived the data. Either way: sign up again.
      bounce(res, "neplatny-odkaz")
      return
    }

    if (subscriber.unsubscribed_at) {
      // See the file comment: confirmation never overrides an unsubscribe.
      bounce(res, "jiz-odhlaseno")
      return
    }

    if (!subscriber.confirmed_at) {
      await newsletter.updateNewsletterSubscribers({
        id: subscriber.id,
        confirmed_at: new Date(),
      } as never)
    }

    bounce(res, "potvrzeno")
  } catch (error) {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `[newsletter] Potvrzení adresy ${email} se nepodařilo: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    bounce(res, "chyba")
  }
}
