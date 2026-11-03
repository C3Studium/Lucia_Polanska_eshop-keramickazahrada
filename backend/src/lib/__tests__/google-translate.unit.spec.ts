import { translateTitles } from "../google-translate"
import { localizedLineTitle, localizedProductName, localeForCountry } from "../email-locale"
import { invoiceFlavourFor, buildInvoicePayload } from "../../modules/idoklad/utils"

const okResponse = (texts: string[]) =>
  ({
    ok: true,
    json: async () => ({ data: { translations: texts.map((translatedText) => ({ translatedText })) } }),
  }) as unknown as Response

describe("translateTitles (Google)", () => {
  const original = process.env.GOOGLE_TRANSLATE_API_KEY
  afterEach(() => {
    process.env.GOOGLE_TRANSLATE_API_KEY = original
  })

  it("bez klíče nevolá Google a název zůstane český", async () => {
    delete process.env.GOOGLE_TRANSLATE_API_KEY
    const fetchImpl = jest.fn()
    const result = await translateTitles(["Hrnek modrý"], "sk", fetchImpl as never)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.size).toBe(0)
    expect(localizedLineTitle({ product_title: "Hrnek modrý" }, "sk")).toBe("Hrnek modrý")
  })

  it("přeloží jedním požadavkem, zapamatuje si to a čeština se nepřekládá", async () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = "test-key"
    const fetchImpl = jest.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body)
      expect(body).toMatchObject({ source: "cs", target: "de", format: "text" })
      expect(body.q).toEqual(["Zápich Pán lesa", "Miska &amp; talířek"])
      return okResponse(["Gartenstecker Waldgeist", "Schale &amp; Teller"])
    })
    const result = await translateTitles(
      ["Zápich Pán lesa", "Miska &amp; talířek", "Zápich Pán lesa"],
      "de",
      fetchImpl as never
    )
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result.get("Zápich Pán lesa")).toBe("Gartenstecker Waldgeist")
    expect(result.get("Miska &amp; talířek")).toBe("Schale & Teller")
    // Ze paměti, bez dalšího volání.
    expect(localizedLineTitle({ product_title: "Zápich Pán lesa" }, "de")).toBe("Gartenstecker Waldgeist")
    expect(localizedProductName("Zápich Pán lesa", "de")).toBe("Gartenstecker Waldgeist")
    expect(localizedLineTitle({ product_title: "Zápich Pán lesa" }, "cs")).toBe("Zápich Pán lesa")
    await translateTitles(["Zápich Pán lesa"], "de", fetchImpl as never)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await translateTitles(["Zápich Pán lesa"], "cs", fetchImpl as never)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("výpadek Googlu nic neshodí", async () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = "test-key"
    const fetchImpl = jest.fn(async () => {
      throw new Error("network")
    })
    const result = await translateTitles(["Váza bílá"], "pl", fetchImpl as never)
    expect(result.size).toBe(0)
    expect(localizedLineTitle({ product_title: "Váza bílá" }, "pl")).toBe("Váza bílá")
  })

  it("překlad uložený na řádku objednávky má přednost", () => {
    expect(
      localizedLineTitle({ product_title: "Hrnek", metadata: { title_en: "Mug" } }, "en")
    ).toBe("Mug")
  })
})

describe("jazyk podle země", () => {
  it("ostatní země dostanou angličtinu, bez země čeština", () => {
    expect(localeForCountry("cz")).toBe("cs")
    expect(localeForCountry("at")).toBe("de")
    expect(localeForCountry("fr")).toBe("en")
    expect(localeForCountry("GB")).toBe("en")
    expect(localeForCountry("")).toBe("cs")
    expect(localeForCountry(null)).toBe("cs")
  })
})

describe("evropská faktura iDoklad", () => {
  const defaults = {
    CurrencyId: 1,
    DateOfIssue: "2026-11-03",
    DateOfMaturity: "2026-11-17",
    DateOfTaxing: "2026-11-03",
    DocumentSerialNumber: 1,
    NumericSequenceId: 1,
    PaymentOptionId: 1,
    Iban: "CZ65 0800 0000 1920 0014 5399",
    Swift: "GIBACZPX",
  }
  const order = (country: string, currency = "czk", locale?: string) => ({
    id: "order_1",
    display_id: 7,
    currency_code: currency,
    total: 100,
    items: [{ title: "Hrnek", quantity: 1, total: 100 }],
    shipping_address: { country_code: country },
    billing_address: { country_code: country },
    metadata: locale ? { locale } : {},
  })

  afterEach(() => {
    delete process.env.IDOKLAD_EU_IBAN
    delete process.env.IDOKLAD_EU_SWIFT
  })

  it("česká objednávka: česká sestava, účet z agendy beze změny", () => {
    expect(invoiceFlavourFor(order("cz") as never)).toEqual({ european: false, reportLanguage: 1 })
    const payload = buildInvoicePayload({ order: order("cz") as never, defaults, partnerId: 1, vatPayer: false })
    expect(payload.ReportLanguage).toBe(1)
    expect(payload.Iban).toBeUndefined()
  })

  it("Slovensko, Německo, Polsko a ostatní: sestava v jejich jazyce (polsky → anglicky) + IBAN", () => {
    expect(invoiceFlavourFor(order("sk", "eur", "sk") as never).reportLanguage).toBe(2)
    expect(invoiceFlavourFor(order("de", "eur", "de") as never).reportLanguage).toBe(4)
    expect(invoiceFlavourFor(order("pl", "eur", "pl") as never).reportLanguage).toBe(3)
    expect(invoiceFlavourFor(order("fr", "eur") as never).reportLanguage).toBe(3)
    const payload = buildInvoicePayload({
      order: order("sk", "eur", "sk") as never,
      defaults,
      partnerId: 1,
      vatPayer: false,
    })
    expect(payload).toMatchObject({ ReportLanguage: 2, Iban: "CZ6508000000192000145399", Swift: "GIBACZPX" })
  })

  it("eurový účet z prostředí má přednost před účtem agendy", () => {
    process.env.IDOKLAD_EU_IBAN = "CZ12 3456"
    process.env.IDOKLAD_EU_SWIFT = "FIOBCZPP"
    const payload = buildInvoicePayload({
      order: order("de", "eur", "de") as never,
      defaults,
      partnerId: 1,
      vatPayer: false,
    })
    expect(payload).toMatchObject({ Iban: "CZ123456", Swift: "FIOBCZPP" })
  })
})
