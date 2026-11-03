import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { render } from "@react-email/components"
import type { ReactElement } from "react"
import { DAY_MS } from "../../../../../../../lib/loyalty-code-rules"
import {
  getLoyaltySettings,
  loadLoyaltyPerson,
  loadNewsletterStatus,
  loyaltyEmailData,
  loyaltyEmailLocale,
  manualBlockReason,
} from "../../../../../../../lib/loyalty-code"
import { getLegalFacts } from "../../../../../../../lib/merchant-settings"
import { localizeStorefrontLinks } from "../../../../../../../lib/storefront-url"
import { withEmailLocale } from "../../../../../../../modules/resend/components/email-i18n"
import { withEmailLegalFacts } from "../../../../../../../modules/resend/components/email-ui"
import { LoyaltyCodeEmail } from "../../../../../../../modules/resend/emails/loyalty-code"
import { localizedSubject } from "../../../../../../../modules/resend/subjects"
import { parseLoyaltyCodeBody } from "../route"

/** Český předmět — stejný jako v Resend provideru (`getTemplateSubject`). */
const SUBJECT_CS = "Malé poděkování — slevový kód jen pro vás"

const LOCALE_LABEL: Record<string, string> = {
  cs: "česky",
  sk: "slovensky",
  pl: "polsky",
  de: "německy",
  en: "anglicky",
}

/**
 * Náhled e-mailu se slevovým kódem — skutečná šablona, skutečný jazyk
 * zákazníka a patička z právních údajů, jen místo kódu ukázka (pravý kód
 * vznikne až odesláním). Nic nezakládá ani neposílá.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = parseLoyaltyCodeBody(req.body)
  const defaults = await getLoyaltySettings(req.scope)
  const percentage = body.percentage ?? defaults.percentage
  const validDays = body.valid_days ?? defaults.valid_days

  const person = await loadLoyaltyPerson(req.scope, { customerId: req.params.customerId })
  if (!person) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Zákazník nebyl nalezen.")
  }
  const [newsletter, locale, legal] = await Promise.all([
    loadNewsletterStatus(req.scope, person.email),
    loyaltyEmailLocale(req.scope, person),
    getLegalFacts(req.scope),
  ])

  const data = loyaltyEmailData({
    person,
    code: "DIKY-UKAZKA",
    percentage,
    endsAt: new Date(Date.now() + validDays * DAY_MS),
  })
  const html = await render(
    withEmailLocale(
      withEmailLegalFacts(
        LoyaltyCodeEmail(
          localizeStorefrontLinks(data, locale, (data.link_country as string | undefined) ?? null) as never
        ),
        legal.source === "settings" ? legal.facts : null
      ),
      locale
    ) as ReactElement
  )

  res.status(200).json({
    html,
    subject: localizedSubject("loyalty-code", locale) ?? SUBJECT_CS,
    locale,
    locale_label: LOCALE_LABEL[locale] ?? locale,
    to: person.email,
    percentage,
    valid_days: validDays,
    blocked_reason: manualBlockReason(person, newsletter),
  })
}
