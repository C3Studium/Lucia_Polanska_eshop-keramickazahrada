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
  // The storefront's newsletter landing page renders each status in the
  // shop's own voice. (Used to be `?newsletter=…` on the homepage, which no
  // page ever read — the person just landed on the homepage unacknowledged.)
  res.redirect(302, `${base}/newsletter?stav=${status}`)
}

/**
 * Samotné odhlášení — sdílené GETem z patičky e-mailu i POSTem, kterým
 * poštovní klient odbaví „Odhlásit odběr" ze záhlaví zprávy (RFC 8058).
 *
 * Vrací stav pro volajícího; ten rozhodne, jestli se přesměrovává na web,
 * nebo odpovídá holým 200.
 */
const odhlas = async (
  req: MedusaRequest,
  email: string
): Promise<"odhlaseno" | "chyba"> => {
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
      /* The goodbye mail is a courtesy — the unsubscribe itself already
         happened above. If the provider refuses it, the page must still say
         „odhlášeno": telling an unsubscribed person the opposite is exactly
         the GDPR complaint this link exists to prevent. */
      await sendCustomerEmail(req.scope, {
        template: "newsletter-unsubscribe",
        to: email,
        key: `nl-unsub:${email}:${day}`,
        data: { email },
      }).catch((error) =>
        req.scope
          .resolve(ContainerRegistrationKeys.LOGGER)
          .error(
            `[newsletter] Rozlučkový e-mail pro ${email} se nepodařilo odeslat: ${
              error instanceof Error ? error.message : "neznámá chyba"
            }`
          )
      )
    }

    return "odhlaseno"
  } catch (error) {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `[newsletter] Odhlášení adresy ${email} se nepodařilo: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    return "chyba"
  }
}

/** Odkaz v patičce e-mailu: odhlásí a pošle člověka na stránku se stavem. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const email = normalizeEmail(
    typeof req.query.email === "string" ? req.query.email : ""
  )

  if (!email || !verifyUnsubscribeToken(email, req.query.token)) {
    // Deliberately vague: a precise message would help someone probing tokens.
    bounce(res, "neplatny-odkaz")
    return
  }

  bounce(res, await odhlas(req, email))
}

/**
 * Jednoklikové odhlášení (RFC 8058).
 *
 * Tohle nevolá člověk, ale jeho poštovní klient: Gmail, Seznam nebo Outlook
 * nabídnou „Odhlásit odběr" v záhlaví zprávy a po potvrzení sem pošlou POST
 * s tělem `List-Unsubscribe=One-Click`. Odpověď nikdo nečte, takže se
 * nepřesměrovává — stačí 200. Chybu hlásíme jako 500, aby to klient zkusil
 * znovu místo toho, aby odhlášení tiše spolkl.
 *
 * Adresu i podpis bere ze stejného query stringu jako GET; hlavička
 * `List-Unsubscribe` nese tutéž URL.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const email = normalizeEmail(
    typeof req.query.email === "string" ? req.query.email : ""
  )

  if (!email || !verifyUnsubscribeToken(email, req.query.token)) {
    res.status(400).send("Neplatný odkaz.")
    return
  }

  const stav = await odhlas(req, email)

  if (stav === "chyba") {
    res.status(500).send("Odhlášení se nepodařilo dokončit.")
    return
  }

  res.status(200).send("Odhlášeno.")
}
