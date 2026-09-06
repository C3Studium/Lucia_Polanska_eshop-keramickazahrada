import ComgatePaymentProviderService from "../service"

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}

const createService = () =>
  new ComgatePaymentProviderService(
    { logger } as any,
    {
      merchant: "merchant-1",
      secret: "secret-1",
      test: true,
      country: "CZ",
      curr: "CZK",
      method: "ALL",
    }
  )

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const providerDetails = (status: string) => ({
  code: 0,
  message: "OK",
  test: "true",
  price: "45000",
  curr: "CZK",
  label: "Keram. zahrada",
  refId: "payses_test",
  method: "CARD_CZ_CS",
  email: "customer@example.com",
  transId: "AAAA-BBBB-CCCC",
  status,
})

describe("Comgate payment provider", () => {
  const originalStorefrontUrl = process.env.STOREFRONT_PUBLIC_URL

  beforeEach(() => {
    process.env.STOREFRONT_PUBLIC_URL = "https://shop.example"
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env.STOREFRONT_PUBLIC_URL = originalStorefrontUrl
  })

  it("creates one exact-method payment tied to the Medusa payment session", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(
        {
          code: 0,
          message: "OK",
          transId: "AAAA-BBBB-CCCC",
          redirect: "https://payments.comgate.cz/client/payment",
        },
        201
      )
    )

    const result = await createService().initiatePayment({
      amount: 450,
      currency_code: "czk",
      context: {
        idempotency_key: "idem-1",
        customer: {
          id: "cus_1",
          email: "customer@example.com",
          first_name: "Jana",
          last_name: "Nováková",
        },
      },
      data: {
        session_id: "payses_test",
        cart_id: "cart_1",
        method: "card_cz_cs",
        url_paid: "/cz/order/confirmed",
      },
    })

    expect(result).toMatchObject({
      id: "AAAA-BBBB-CCCC",
      status: "pending",
      data: {
        session_id: "payses_test",
        refId: "payses_test",
        method: "CARD_CZ_CS",
        redirectUrl: "https://payments.comgate.cz/client/payment",
      },
    })

    const request = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      test: true,
      price: 45_000,
      curr: "CZK",
      refId: "payses_test",
      payerId: "cart_1",
      method: "CARD_CZ_CS",
      email: "customer@example.com",
      fullName: "Jana Nováková",
      url_paid: "https://shop.example/cz/order/confirmed",
    })
  })

  it.each([
    ["PENDING", "pending"],
    ["AUTHORIZED", "pending_authorization"],
    ["PAID", "captured"],
    ["CANCELLED", "canceled"],
  ])("maps Comgate %s to Medusa %s", async (providerStatus, medusaStatus) => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse(providerDetails(providerStatus)))

    await expect(
      createService().getPaymentStatus({
        data: { transId: "AAAA-BBBB-CCCC" },
      })
    ).resolves.toMatchObject({ status: medusaStatus })
  })

  it("queries Comgate before treating an authenticated callback as captured", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse(providerDetails("PAID")))

    await expect(
      createService().getWebhookActionAndData({
        data: {
          merchant: "merchant-1",
          secret: "secret-1",
          transId: "AAAA-BBBB-CCCC",
          test: "true",
          price: "45000",
          curr: "CZK",
          refId: "payses_test",
          status: "PAID",
        },
        rawData: Buffer.from(""),
        headers: {},
      })
    ).resolves.toEqual({
      action: "captured",
      data: { session_id: "payses_test", amount: "450" },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("rejects an invalid callback secret without querying the transaction", async () => {
    const fetchMock = jest.spyOn(global, "fetch")

    await expect(
      createService().getWebhookActionAndData({
        data: {
          merchant: "merchant-1",
          secret: "wrong",
          transId: "AAAA-BBBB-CCCC",
        },
        rawData: Buffer.from(""),
        headers: {},
      })
    ).resolves.toEqual({ action: "not_supported" })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  /*
   * Protokol v2.0: oznámení nenese `secret` ani `merchant` — merchant a heslo
   * jdou v hlavičce odchozích dotazů, ne v těle příchozího upozornění. Tenhle
   * tvar musí projít, jinak neprojde žádná skutečná platba.
   */
  it("accepts a v2.0 notification that carries no secret in the body", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse(providerDetails("PAID")))

    await expect(
      createService().getWebhookActionAndData({
        data: { transId: "AAAA-BBBB-CCCC", status: "PAID" },
        rawData: Buffer.from(""),
        headers: {},
      })
    ).resolves.toEqual({
      action: "captured",
      data: { session_id: "payses_test", amount: "450" },
    })

    // O stavu nerozhoduje tělo, ale ověřený dotaz zpět na ComGate.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("accepts a bare v2.0 notification and reports the verified status", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse(providerDetails("CANCELLED")))

    await expect(
      createService().getWebhookActionAndData({
        data: { transId: "AAAA-BBBB-CCCC" },
        rawData: Buffer.from(""),
        headers: {},
      })
    ).resolves.toMatchObject({ action: "canceled" })
  })

  /* Tělo, které tvrdí něco jiného než ověřená odpověď, je záměna nebo podvrh. */
  it("rejects a notification whose body contradicts the verified payment", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse(providerDetails("PAID")))

    await expect(
      createService().getWebhookActionAndData({
        data: {
          transId: "AAAA-BBBB-CCCC",
          status: "PAID",
          refId: "payses_nekoho_jineho",
        },
        rawData: Buffer.from(""),
        headers: {},
      })
    ).resolves.toEqual({ action: "not_supported" })
  })

  /* Odmítnutí se musí dát vyslovit i bez loggeru — jinak z „nepatří nám"
     vznikne pád a ComGate opakuje pokusy donekonečna. */
  it("rejects without a logger instead of throwing", async () => {
    const bezLoggeru = new (ComgatePaymentProviderService as any)({} as any, {
      merchant: "merchant-1",
      secret: "secret-1",
      test: true,
      country: "CZ",
      curr: "CZK",
      method: "ALL",
    })

    await expect(
      bezLoggeru.getWebhookActionAndData({
        data: { merchant: "merchant-1", secret: "wrong" },
        rawData: Buffer.from(""),
        headers: {},
      })
    ).resolves.toEqual({ action: "not_supported" })
  })
})
