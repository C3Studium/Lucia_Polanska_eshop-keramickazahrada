import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { storefrontBase } from "../../lib/storefront-url"
import { normalizeEmail } from "../../lib/newsletter-link"
import {
  EMAIL_OPTOUT_KIND_LABEL,
  isEmailOptOutKind,
  verifyEmailOptOutToken,
} from "../../lib/email-optout-link"
import { emailOptOutStore, recordEmailOptOut } from "../../lib/email-optout"

/**
 * „Nechcete tyto e-maily? Odhlásit je jedním kliknutím" — odkaz v patičce
 * prosby o recenzi, upozornění na pokles ceny a připomenutí košíku
 * (§ 7 odst. 3 zákona č. 480/2004 Sb., čl. 21 GDPR).
 *
 * Stejný tvar jako `/newsletter/unsubscribe`: poštovní klient umí jen holý
 * GET bez hlaviček, proto podepsaný token (`lib/email-optout-link.ts`)
 * a top-level routa (`/store/*` chce publishable key). GET s vedlejším
 * účinkem je vědomý obchod — účinek je idempotentní, takže prefetch klienta
 * nebo dvojklik skončí na stejném místě.
 *
 * Výsledek se ukáže na stránce newsletteru storefrontu
 * (`/newsletter?stav=odhlaseno-upozorneni&druh=<druh>`); bez nastaveného
 * storefrontu česká věta rovnou tady.
 */

const fallbackText = (status: string, kind: string | null): string => {
  if (status === "odhlaseno-upozorneni") {
    const what =
      kind && isEmailOptOutKind(kind) ? EMAIL_OPTOUT_KIND_LABEL[kind] : "tyto e-maily"
    return `Hotovo — ${what} vám už posílat nebudeme.`
  }
  if (status === "neplatny-odkaz") {
    return "Odkaz pro odhlášení není platný. Napište nám prosím na info@keramickazahrada.cz."
  }
  return "Odhlášení se nepodařilo dokončit. Zkuste odkaz otevřít znovu, nebo nám napište na info@keramickazahrada.cz."
}

const bounce = (res: MedusaResponse, status: string, kind: string | null = null) => {
  const base = storefrontBase()
  if (!base) {
    res.status(200).type("text/plain").send(fallbackText(status, kind))
    return
  }
  const druh = kind ? `&druh=${encodeURIComponent(kind)}` : ""
  res.redirect(302, `${base}/newsletter?stav=${status}${druh}`)
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const email = normalizeEmail(
    typeof req.query.email === "string" ? req.query.email : ""
  )
  const kind = typeof req.query.kind === "string" ? req.query.kind : ""

  if (!email || !isEmailOptOutKind(kind) || !verifyEmailOptOutToken(email, kind, req.query.token)) {
    // Schválně vágně: přesná hláška by pomohla tomu, kdo zkouší tokeny.
    bounce(res, "neplatny-odkaz")
    return
  }

  try {
    await recordEmailOptOut(emailOptOutStore(req.scope), email, kind)
    bounce(res, "odhlaseno-upozorneni", kind)
  } catch (error) {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `[email-optout] Odmítnutí „${kind}" pro ${email} se nepodařilo uložit: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    bounce(res, "chyba")
  }
}
