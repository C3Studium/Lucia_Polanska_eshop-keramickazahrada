import {
  IDOKLAD_TOKEN_URL_LEGACY,
  IDOKLAD_TOKEN_URL_V2,
  IdokladApiError,
  buildContactPayload,
  buildInvoiceItems,
  buildInvoicePayload,
  createTokenRequest,
  pickBankAccount,
  pickPaymentOptionId,
  requestIdokladJson,
  toVariableSymbol,
} from "../utils"
import {
  VAT_RATE_TYPE_BASIC,
  VAT_RATE_TYPE_ZERO,
  type IdokladInvoiceDefault,
} from "../types"

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const defaults: IdokladInvoiceDefault = {
  CurrencyId: 2,
  DateOfIssue: "2026-08-14",
  DateOfMaturity: "2026-08-28",
  DateOfTaxing: "2026-08-14",
  DocumentSerialNumber: 42,
  NumericSequenceId: 18,
  PaymentOptionId: 21,
  IsIncomeTax: true,
}

const order = {
  id: "order_1",
  display_id: 1024,
  email: "jana@example.com",
  currency_code: "czk",
  total: 1550,
  shipping_total: 120,
  items: [
    { product_title: "Váza Modrá", title: "Váza", quantity: 2, total: 1000 },
    { title: "Miska", quantity: 1, total: 430 },
  ],
  shipping_methods: [{ name: "Balíkovna" }],
  billing_address: {
    first_name: "Jana",
    last_name: "Nováková",
    address_1: "Dlouhá 12",
    city: "Písek",
    postal_code: "397 01",
    country_code: "cz",
    phone: "+420 777 111 222",
  },
}

describe("iDoklad utils", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("toVariableSymbol", () => {
    it("keeps only digits and at most ten of them", () => {
      expect(toVariableSymbol(1024)).toBe("1024")
      expect(toVariableSymbol("#2026-00042")).toBe("202600042")
      expect(toVariableSymbol("123456789012")).toBe("1234567890")
    })

    it("returns undefined when nothing numeric remains", () => {
      expect(toVariableSymbol("abc")).toBeUndefined()
      expect(toVariableSymbol(undefined)).toBeUndefined()
    })
  })

  describe("createTokenRequest", () => {
    it("uses the v2 endpoint with the application id when configured", () => {
      const { url, body } = createTokenRequest({
        clientId: "cid",
        clientSecret: "sec",
        applicationId: "app-1",
      })
      expect(url).toBe(IDOKLAD_TOKEN_URL_V2)
      expect(body.get("application_id")).toBe("app-1")
      expect(body.get("grant_type")).toBe("client_credentials")
      expect(body.get("scope")).toBe("idoklad_api")
    })

    it("falls back to the legacy endpoint without an application id", () => {
      const { url, body } = createTokenRequest({
        clientId: "cid",
        clientSecret: "sec",
      })
      expect(url).toBe(IDOKLAD_TOKEN_URL_LEGACY)
      expect(body.get("application_id")).toBeNull()
    })
  })

  describe("buildInvoiceItems", () => {
    it("maps items and shipping so the lines sum to the order total", () => {
      const lines = buildInvoiceItems(order as any, false)

      expect(lines.map((line) => line.Name)).toEqual([
        "Váza Modrá",
        "Miska",
        "Poštovné — Balíkovna",
      ])
      expect(lines[0]).toMatchObject({ Amount: 2, UnitPrice: 500, Unit: "ks" })
      expect(lines[2]).toMatchObject({ Amount: 1, UnitPrice: 120 })

      const sum = lines.reduce((acc, line) => acc + line.Amount * line.UnitPrice, 0)
      expect(sum).toBe(1550)
    })

    it("puts each Balné line right under its product (lib/packaging.ts)", () => {
      const withPackaging = {
        ...order,
        total: 1550 + 70,
        items: [
          { ...(order as any).items[0], variant_id: "var_vaza" },
          { ...(order as any).items[1], variant_id: "var_miska" },
          {
            title: "Balné — Miska",
            quantity: 1,
            total: 20,
            variant_id: null,
            product_id: null,
            metadata: { packaging_fee: true, packaging_variant_id: "var_miska" },
          },
          {
            title: "Balné — Váza Modrá",
            quantity: 2,
            total: 50,
            variant_id: null,
            product_id: null,
            metadata: { packaging_fee: true, packaging_variant_id: "var_vaza" },
          },
        ],
      }
      const lines = buildInvoiceItems(withPackaging as any, false)
      expect(lines.map((line) => line.Name)).toEqual([
        "Váza Modrá",
        "Balné — Váza Modrá",
        "Miska",
        "Balné — Miska",
        "Poštovné — Balíkovna",
      ])
      expect(lines[1]).toMatchObject({ Amount: 2, UnitPrice: 25 })
      const sum = lines.reduce((acc, line) => acc + line.Amount * line.UnitPrice, 0)
      expect(sum).toBe(1620)
    })

    it("absorbs per-unit rounding into a Zaokrouhlení line", () => {
      const oddOrder = {
        ...order,
        total: 100,
        shipping_total: 0,
        items: [{ title: "Tři misky", quantity: 3, total: 100 }],
      }
      const lines = buildInvoiceItems(oddOrder as any, false)

      // 100 / 3 → 33.33 per piece = 99.99; the last line carries the haléř.
      expect(lines).toHaveLength(2)
      expect(lines[1].Name).toBe("Zaokrouhlení")
      expect(lines[1].UnitPrice).toBe(0.01)
      const sum = lines.reduce((acc, line) => acc + line.Amount * line.UnitPrice, 0)
      expect(Math.round(sum * 100) / 100).toBe(100)
    })

    it("writes zero VAT for the non-payer and the basic rate for a payer", () => {
      expect(
        buildInvoiceItems(order as any, false).every(
          (line) => line.VatRateType === VAT_RATE_TYPE_ZERO
        )
      ).toBe(true)
      expect(
        buildInvoiceItems(order as any, true).every(
          (line) => line.VatRateType === VAT_RATE_TYPE_BASIC
        )
      ).toBe(true)
    })
  })

  describe("buildContactPayload", () => {
    it("names a private person by their billing name", () => {
      const contact = buildContactPayload(order as any, 7)
      expect(contact).toMatchObject({
        CompanyName: "Jana Nováková",
        Firstname: "Jana",
        Surname: "Nováková",
        Email: "jana@example.com",
        Street: "Dlouhá 12",
        City: "Písek",
        PostalCode: "397 01",
        CountryId: 7,
        Mobile: "+420 777 111 222",
      })
    })

    it("prefers an explicit company and survives a bare order", () => {
      const company = buildContactPayload(
        {
          ...order,
          billing_address: { ...order.billing_address, company: "Atelier s.r.o." },
        } as any
      )
      expect(company.CompanyName).toBe("Atelier s.r.o.")

      const bare = buildContactPayload({ id: "order_2" } as any)
      expect(bare.CompanyName).toBe("Zákazník e-shopu")
    })
  })

  describe("buildInvoicePayload", () => {
    it("merges agenda defaults with the order facts", () => {
      const payload = buildInvoicePayload({
        order: order as any,
        defaults,
        partnerId: 555,
        vatPayer: false,
      })

      expect(payload).toMatchObject({
        CurrencyId: 2,
        DocumentSerialNumber: 42,
        NumericSequenceId: 18,
        PaymentOptionId: 21,
        PartnerId: 555,
        OrderNumber: "1024",
        VariableSymbol: "1024",
        IsEet: false,
        IsIncomeTax: true,
        Description: "Objednávka #1024",
      })
      expect(payload.Items.length).toBe(3)
    })

    it("lets an explicit numeric sequence and payment option win", () => {
      const payload = buildInvoicePayload({
        order: order as any,
        defaults,
        partnerId: 555,
        vatPayer: false,
        numericSequenceId: 99,
        paymentOptionId: 33,
        currencyId: 5,
      })
      expect(payload.NumericSequenceId).toBe(99)
      expect(payload.PaymentOptionId).toBe(33)
      expect(payload.CurrencyId).toBe(5)
    })

    /*
     * Eurová faktura (5. 11. 2026). Bez kurzu iDoklad počítá korunovou
     * hodnotu dokladu jedna ku jedné — 60 € by se v účetnictví objevilo jako
     * 60 Kč — a bez eurového účtu by zákazník poslal eura na korunový.
     */
    it("faktura v cizí měně nese kurz i eurový účet", () => {
      const payload = buildInvoicePayload({
        order: order as any,
        defaults,
        partnerId: 555,
        vatPayer: false,
        currencyId: 2,
        bankAccount: {
          Id: 77,
          Name: "Eurový účet",
          CurrencyId: 2,
          Iban: "CZ55 2010 0000 0027 0128 1289",
          Swift: "FIOBCZPP",
        },
        exchangeRate: {
          Id: 491909,
          CurrencyId: 2,
          Date: "2026-11-04",
          ExchangeRateValue: 24.31,
          Amount: 1,
        },
      })

      expect(payload.ExchangeRate).toBe(24.31)
      expect(payload.ExchangeRateAmount).toBe(1)
      expect(payload.BankId).toBe(77)
      /* Mezery v IBANu chodí z iDokladu i z nastavení — na dokladu nesmí být. */
      expect(payload.Iban).toBe("CZ5520100000002701281289")
      expect(payload.Swift).toBe("FIOBCZPP")
    })

    it("korunová faktura kurz nepřidává", () => {
      const payload = buildInvoicePayload({
        order: { ...order, currency_code: "czk" } as any,
        defaults,
        partnerId: 555,
        vatPayer: false,
      })

      expect(payload.ExchangeRate).toBeUndefined()
      expect(payload.ExchangeRateAmount).toBeUndefined()
      expect(payload.BankId).toBeUndefined()
    })
  })

  describe("pickBankAccount", () => {
    const ucty = [
      { Id: 19, Name: "Hlavní bankovní spojení", CurrencyId: 1, IsDefault: true },
      { Id: 77, Name: "Eurový účet", CurrencyId: 2, IsDefault: false },
      { Id: 78, Name: "Eurový záložní", CurrencyId: 2, IsDefault: true },
    ]

    it("vybere účet v měně dokladu a dá přednost výchozímu", () => {
      expect(pickBankAccount(ucty, 2)?.Id).toBe(78)
      expect(pickBankAccount(ucty, 1)?.Id).toBe(19)
    })

    /* Koruna účet nepředává — zůstane ten z nastavení agendy. */
    it("bez měny nebo bez účtu v té měně nevrací nic", () => {
      expect(pickBankAccount(ucty, undefined)).toBeUndefined()
      expect(pickBankAccount(ucty, 8)).toBeUndefined()
      expect(pickBankAccount([], 2)).toBeUndefined()
    })
  })

  describe("pickPaymentOptionId", () => {
    const options = [
      { Id: 1, Name: "Převodem" },
      { Id: 2, Name: "Dobírkou" },
      { Id: 3, Name: "Platební kartou" },
    ]

    it("matches dobírka by name, diacritics-insensitively", () => {
      expect(pickPaymentOptionId(options, { cod: true, defaultId: 1 })).toBe(2)
    })

    it("prefers card for online payments and falls back to the default", () => {
      expect(pickPaymentOptionId(options, { cod: false, defaultId: 1 })).toBe(3)
      expect(pickPaymentOptionId([], { cod: false, defaultId: 1 })).toBe(1)
      expect(pickPaymentOptionId([], { cod: true })).toBeUndefined()
    })
  })

  describe("requestIdokladJson", () => {
    it("unwraps the envelope on success", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue(
        jsonResponse({
          Data: { Id: 7 },
          IsSuccess: true,
          Message: "",
          StatusCode: 200,
          ErrorCode: 0,
        })
      )
      await expect(
        requestIdokladJson<{ Id: number }>("/IssuedInvoices/7", { token: "t" })
      ).resolves.toEqual({ Id: 7 })
    })

    it("throws iDoklad's own message when IsSuccess is false", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue(
        jsonResponse({
          Data: null,
          IsSuccess: false,
          Message: "Doklad nelze uložit",
          StatusCode: 400,
          ErrorCode: 101,
        })
      )
      await expect(
        requestIdokladJson("/IssuedInvoices", { token: "t", method: "POST", body: {} })
      ).rejects.toThrow("Doklad nelze uložit")
    })

    it("labels a non-JSON answer instead of crashing on parse", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(new Response("<html>502</html>", { status: 502 }))
      await expect(
        requestIdokladJson("/IssuedInvoices", { token: "t" })
      ).rejects.toBeInstanceOf(IdokladApiError)
    })
  })
})
