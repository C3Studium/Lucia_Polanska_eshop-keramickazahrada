import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { withEmailLocale } from "../components/email-i18n"
import { LoyaltyCodeEmail } from "../emails/loyalty-code"
import { LOCALIZED_SUBJECTS } from "../subjects"
import type { EmailLocale } from "../../../lib/email-locale"

/**
 * E-mail se slevovým kódem pro stálého zákazníka ve všech pěti jazycích.
 * Stejné stopy češtiny jako `email-locales.unit.spec.tsx` (tam šablonu
 * doplní, kdo spravuje ten seznam).
 */
const CZECH_TRACES: RegExp[] = [
  /[ěřůĚŘŮ]/,
  /\b(jsem|jste|jsou|který|která|které|můžete|zboží|kousek|kousky|děkuji|objednávku jsem|Dobrý den)\b/i,
]
const FOREIGN_IN_ENGLISH = /\b(Ihre|Ihnen|Bestellung|Werkstatt|Państwo|Państwa|zamówienie|objednávka|objednávku|Dobrý deň|vášho|vašu)\b/

const textOf = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#xA0;/g, " ")
    .replace(/\s+/g, " ")

const props = {
  customerName: "Jana",
  code: "DIKY-K7M2QX",
  percentage: 15,
  expiresAt: "2026-12-31T12:00:00.000Z",
  registered: true,
  shopLink: "https://keramickazahrada.cz/cz/store",
  unsubscribeLink: "https://api.keramickazahrada.cz/newsletter/unsubscribe?token=abc",
}

const render = (locale: EmailLocale, override: Partial<typeof props> = {}) =>
  renderToStaticMarkup(
    withEmailLocale(<LoyaltyCodeEmail {...props} {...override} />, locale) as React.ReactElement
  )

describe("e-mail se slevovým kódem", () => {
  const env = process.env
  beforeAll(() => {
    process.env = { ...env, STOREFRONT_PUBLIC_URL: "https://keramickazahrada.cz" }
  })
  afterAll(() => {
    process.env = env
  })

  it("česky nese kód, slevu, platnost, odkaz do obchodu a odhlášení", () => {
    const html = render("cs")
    const text = textOf(html)
    expect(html).toContain('lang="cs"')
    expect(text).toContain("DIKY-K7M2QX")
    expect(text).toContain("15 % z ceny výrobků")
    expect(text).toContain("31. prosince 2026")
    expect(text).toContain("přihlášení ke svému účtu")
    expect(text).toMatch(/nevztahuje na poštovné, balné a dárkové poukazy/)
    expect(html).toContain('href="https://keramickazahrada.cz/cz/store"')
    expect(html).toContain("newsletter/unsubscribe?token=abc")
  })

  it("host bez účtu dostane radu vyplnit e-mail dřív než kód", () => {
    expect(textOf(render("cs", { registered: false }))).toContain("vyplňte dřív, než kód zadáte")
  })

  it("bez odhlašovacího odkazu nabídne odhlášení e-mailem", () => {
    expect(textOf(render("cs", { unsubscribeLink: "" }))).toContain("info@keramickazahrada.cz")
  })

  describe.each(["sk", "pl", "de", "en"] as const)("%s", (locale) => {
    it("nemá české zbytky a má kód i přeložený předmět", () => {
      const html = render(locale)
      const text = textOf(html)
      expect(html).toContain(`lang="${locale}"`)
      expect(text).toContain("DIKY-K7M2QX")
      for (const trace of CZECH_TRACES) expect(text).not.toMatch(trace)
      expect(LOCALIZED_SUBJECTS["loyalty-code"]?.[locale]).toBeTruthy()
    })
  })

  it("anglicky bez zbytků jiných překladů", () => {
    expect(textOf(render("en"))).not.toMatch(FOREIGN_IN_ENGLISH)
  })
})
