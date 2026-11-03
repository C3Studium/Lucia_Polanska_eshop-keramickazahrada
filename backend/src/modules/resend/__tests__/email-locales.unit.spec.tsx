import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { withEmailLocale } from "../components/email-i18n"
import { LOCALIZED_SUBJECTS } from "../subjects"
import type { EmailLocale } from "../../../lib/email-locale"

/**
 * Zákaznické e-maily ve slovenštině, polštině, němčině a angličtině — kontrola na
 * skutečně vykresleném HTML (náhledová data šablony, `export default`).
 *
 * Proč takhle: překlad se rozbije potichu. Kdo do šablony připíše českou
 * větu mimo `COPY`, uvidí ji jen zákazník ze Slovenska. Test proto hledá
 * v cizojazyčném vykreslení stopy češtiny, které v sk/pl/de nemají co
 * dělat — písmena ě, ř, ů a typicky česká slova — a ověří `<html lang>`.
 *
 * Náhledová data (jména, adresy, názvy produktů) jsou česká záměrně: jde
 * o data objednávky, ne o text šablony. Kdyby některá spustila kontrolu,
 * patří do `DATA_ALLOWED` níž, ne do šablony.
 */

/** Šablony, které zákazníkovi chodí v jeho jazyce (kurzy a majitelka ne). */
export const TRANSLATED_TEMPLATES = [
  "abandoned-cart",
  "account-deleted",
  "commission-cancelled",
  "commission-completed",
  "commission-confirmed",
  "commission-inquiry-received",
  "commission-message",
  "commission-price-agreed",
  "contract-resent",
  "email-verification",
  "gift-voucher",
  "gift-voucher-payment",
  "invoice-issued",
  "newsletter-signup",
  "newsletter-unsubscribe",
  "newsletter-welcome",
  "order-cancelled",
  "order-delayed",
  "order-delivered",
  "order-edited",
  "order-placed",
  "order-preparing",
  "order-processing",
  "order-ready",
  "order-ready-pickup",
  "order-refunded",
  "order-review",
  "order-shipment",
  "password-reset",
  "payment-failed",
  "payment-pending",
  "payment-received",
  "payment-refunded",
  "price-drop",
  "production-started",
  "refund-request",
  "restock",
  "return-approved",
  "return-received",
  "return-rejected",
  "return-resolved",
  "surcharge-confirmed",
  "surcharge-notice",
  "welcome",
] as const

/** Šablona → jméno v provideru (předměty), kde se liší od souboru. */
const TEMPLATE_KEY: Record<string, string> = { restock: "variant-restock" }

/** Česká data z náhledů, která kontrolu spustit smějí (ne text šablony). */
const DATA_ALLOWED: RegExp[] = [/Česká pošta/g]

const CZECH_TRACES: RegExp[] = [
  /[ěřůĚŘŮ]/,
  /\b(jsem|jste|jsou|který|která|které|můžete|zboží|kousek|kousky|děkuji|objednávku jsem|Dobrý den)\b/i,
]

/**
 * Angličtina (ostatní země) vznikala z češtiny podle sk/de vzoru — hlídá se,
 * ať v ní nezůstane věta z jiného překladu.
 */
const FOREIGN_IN_ENGLISH: RegExp[] = [
  /\b(Ihre|Ihnen|Bestellung|Werkstatt|Państwo|Państwa|zamówienie|objednávka|objednávku|Dobrý deň|vášho|vašu)\b/,
]

const textOf = (html: string): string => {
  let text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#xA0;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
  for (const allowed of DATA_ALLOWED) text = text.replace(allowed, " ")
  return text
}

/** Okolí nálezu, ať je z chyby hned vidět, která věta zůstala česky. */
const czechLeftovers = (text: string, traces: RegExp[] = CZECH_TRACES): string[] => {
  const found: string[] = []
  for (const trace of traces) {
    const global = new RegExp(trace.source, trace.flags.includes("g") ? trace.flags : trace.flags + "g")
    for (const match of text.matchAll(global)) {
      const at = match.index ?? 0
      found.push(text.slice(Math.max(0, at - 40), at + 40).trim())
    }
  }
  return Array.from(new Set(found))
}

const render = (template: string, locale: EmailLocale): string => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(`../emails/${template}`)
  const Preview = mod.default as () => React.ReactElement
  return renderToStaticMarkup(withEmailLocale(<Preview />, locale) as React.ReactElement)
}

describe("zákaznické e-maily v jazyce zákazníka", () => {
  const env = process.env
  beforeAll(() => {
    process.env = { ...env, STOREFRONT_PUBLIC_URL: "https://keramickazahrada.cz" }
  })
  afterAll(() => {
    process.env = env
  })

  describe.each(["sk", "pl", "de", "en"] as const)("%s", (locale) => {
    it.each(TRANSLATED_TEMPLATES)("%s nemá české zbytky", (template) => {
      const html = render(template, locale)
      expect(html).toContain(`lang="${locale}"`)
      expect(czechLeftovers(textOf(html))).toEqual([])
    })

    it.each(TRANSLATED_TEMPLATES)("%s má přeložený předmět", (template) => {
      const key = TEMPLATE_KEY[template] ?? template
      expect(LOCALIZED_SUBJECTS[key]?.[locale]).toBeTruthy()
    })
  })

  it.each(TRANSLATED_TEMPLATES)("%s anglicky nemá zbytky jiných překladů", (template) => {
    expect(czechLeftovers(textOf(render(template, "en")), FOREIGN_IN_ENGLISH)).toEqual([])
  })

  it.each(TRANSLATED_TEMPLATES)("%s česky beze změny vykreslí češtinu", (template) => {
    const html = render(template, "cs")
    expect(html).toContain('lang="cs"')
  })
})
