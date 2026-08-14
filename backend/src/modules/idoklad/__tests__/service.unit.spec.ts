import IdokladModuleService from "../service"
import { IDOKLAD_TOKEN_URL_V2 } from "../utils"

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}

const createService = (options: Record<string, unknown> = {}) =>
  new IdokladModuleService({ logger } as any, {
    client_id: "cid",
    client_secret: "sec",
    application_id: "app-1",
    ...options,
  } as any)

const tokenResponse = () =>
  new Response(
    JSON.stringify({
      access_token: "token-1",
      token_type: "Bearer",
      expires_in: 6000,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )

const envelopeResponse = (data: unknown) =>
  new Response(
    JSON.stringify({
      Data: data,
      IsSuccess: true,
      Message: "",
      StatusCode: 200,
      ErrorCode: 0,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )

describe("iDoklad module service", () => {
  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it("requires client id and secret", () => {
    expect(() => IdokladModuleService.validateOptions({})).toThrow()
    expect(() =>
      IdokladModuleService.validateOptions({ client_id: "a", client_secret: "b" })
    ).not.toThrow()
  })

  it("parses the vat-payer flag and the numeric sequence override", () => {
    expect(createService().vatPayer).toBe(false)
    expect(createService({ vat_payer: "true" }).vatPayer).toBe(true)
    expect(createService().numericSequenceId).toBeUndefined()
    expect(createService({ numeric_sequence_id: "77" }).numericSequenceId).toBe(77)
  })

  it("reports test mode only when the flag is set", () => {
    expect(createService().testMode).toBe(false)
    expect(createService({ test_mode: "true" }).testMode).toBe(true)
  })

  it("fetches the token once and reuses it across calls", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input)
        if (url.startsWith("https://identity.idoklad.cz")) {
          return tokenResponse()
        }
        return envelopeResponse({ Items: [] })
      })

    const service = createService()
    await service.listPaymentOptions()
    await service.findContactByEmail("jana@example.com")

    const tokenCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith("https://identity.idoklad.cz")
    )
    expect(tokenCalls).toHaveLength(1)
    expect(String(tokenCalls[0][0])).toBe(IDOKLAD_TOKEN_URL_V2)
    expect(String(tokenCalls[0][1]?.body)).toContain("application_id=app-1")

    const apiCalls = fetchMock.mock.calls.filter(
      ([input]) => !String(input).startsWith("https://identity.idoklad.cz")
    )
    expect(apiCalls).toHaveLength(2)
    for (const [, init] of apiCalls) {
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer token-1"
      )
    }
  })

  it("records a full payment with the payment date in the query", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input)
        if (url.startsWith("https://identity.idoklad.cz")) {
          return tokenResponse()
        }
        return envelopeResponse(true)
      })

    await createService().fullyPayInvoice(123, "2026-08-14")

    const [payCall] = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("FullyPay")
    )
    expect(String(payCall[0])).toBe(
      "https://api.idoklad.cz/v3/IssuedDocumentPayments/FullyPay/123?dateOfPayment=2026-08-14"
    )
    expect(payCall[1]?.method).toBe("PUT")
  })

  it("decodes the invoice PDF from the base64 envelope", async () => {
    const bytes = Buffer.from("%PDF-1.7 fake")
    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.startsWith("https://identity.idoklad.cz")) {
        return tokenResponse()
      }
      return envelopeResponse(bytes.toString("base64"))
    })

    const pdf = await createService().getInvoicePdf(55)
    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.toString()).toBe("%PDF-1.7 fake")
  })

  it("propagates iDoklad errors with the API message", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.startsWith("https://identity.idoklad.cz")) {
        return tokenResponse()
      }
      return new Response(
        JSON.stringify({
          Data: null,
          IsSuccess: false,
          Message: "Překročen limit volání API",
          StatusCode: 429,
          ErrorCode: 0,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      )
    })

    await expect(createService().getInvoiceDefault()).rejects.toThrow(
      "Překročen limit volání API"
    )
  })
})
