import {
  ComgateApiError,
  fromComgateMinorUnits,
  parseComgateStatus,
  requestComgateJson,
  resolveComgateExpirationTime,
  resolveComgateMethod,
  resolveStorefrontReturnUrl,
  secureCompare,
  toComgateMinorUnits,
} from "../utils"

describe("Comgate helpers", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("normalizes an exact Comgate payment method and rejects malformed input", () => {
    expect(resolveComgateMethod(" bank_only ")).toBe("BANK_ONLY")
    expect(resolveComgateMethod("CARD<script>", "ALL")).toBe("ALL")
  })

  it("converts major units without silently rounding invalid precision", () => {
    expect(toComgateMinorUnits("450.25", "CZK")).toBe(45_025)
    expect(toComgateMinorUnits({ value: "450.25", precision: 20 }, "CZK")).toBe(
      45_025
    )
    expect(fromComgateMinorUnits("45025")).toBe("450.25")
    expect(() => toComgateMinorUnits(1.001, "CZK")).toThrow(
      "too many decimal places"
    )
    expect(() => toComgateMinorUnits(100.5, "HUF")).toThrow("whole forints")
  })

  it("accepts only Comgate's 30-minute to seven-day expiration window", () => {
    expect(resolveComgateExpirationTime("30m")).toBe("30m")
    expect(resolveComgateExpirationTime("168h")).toBe("168h")
    expect(resolveComgateExpirationTime("7d")).toBe("7d")
    expect(() => resolveComgateExpirationTime("29m")).toThrow()
    expect(() => resolveComgateExpirationTime("8d")).toThrow()
  })

  it("keeps return URLs on the configured storefront origin", () => {
    expect(
      resolveStorefrontReturnUrl(
        "https://shop.example/ignored/base",
        "/cz/order/confirmed",
        "/cz/cart"
      )
    ).toBe("https://shop.example/cz/order/confirmed")
    expect(
      resolveStorefrontReturnUrl(
        "https://shop.example",
        "//attacker.example/redirect",
        "/cz/cart"
      )
    ).toBe("https://shop.example/cz/cart")
  })

  it("compares callback secrets and parses only known payment states", () => {
    expect(secureCompare("secret", "secret")).toBe(true)
    expect(secureCompare("secret", "different")).toBe(false)
    expect(parseComgateStatus(" paid ")).toBe("PAID")
    expect(() => parseComgateStatus("SUCCESS")).toThrow()
  })

  it("uses Basic auth and rejects a provider error code on HTTP 200", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 1400, message: "wrong query" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    await expect(
      requestComgateJson("/payment/transId/TEST.json", {
        merchant: "merchant",
        secret: "secret",
      })
    ).rejects.toMatchObject<Partial<ComgateApiError>>({ code: 1400 })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://payments.comgate.cz/v2.0/payment/transId/TEST.json",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("merchant:secret").toString(
            "base64"
          )}`,
        }),
      })
    )
  })

  it("accepts an empty successful mutation response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 204 }))

    await expect(
      requestComgateJson("/payment/transId/TEST.json", {
        merchant: "merchant",
        secret: "secret",
        method: "DELETE",
      })
    ).resolves.toEqual({})
  })
})
