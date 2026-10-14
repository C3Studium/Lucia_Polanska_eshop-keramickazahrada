import {
  isCustomAmountVoucher,
  validateVoucherAmount,
  VOUCHER_DEFAULTS,
  voucherConfig,
  voucherLineProblem,
} from "../voucher"

/**
 * Poukaz s vlastní částkou: částka zvolená zákazníkem se stává cenou řádku,
 * takže každá díra ve validaci je sleva, kterou si zákazník naservíruje sám.
 * Pinováno: výchozí meze, odolnost proti špatně vyplněným metadatům, krok,
 * měna košíku a pojistka pro řádek přidaný mimo vlastní cestu.
 */

describe("voucher — config", () => {
  it("recognises the flag as boolean or string", () => {
    expect(isCustomAmountVoucher({ voucher_custom_amount: true })).toBe(true)
    expect(isCustomAmountVoucher({ voucher_custom_amount: "true" })).toBe(true)
    expect(isCustomAmountVoucher({ voucher_custom_amount: false })).toBe(false)
    expect(isCustomAmountVoucher({})).toBe(false)
    expect(isCustomAmountVoucher(null)).toBe(false)
  })

  it("falls back to the defaults when metadata is absent", () => {
    expect(voucherConfig({})).toEqual({ ...VOUCHER_DEFAULTS })
    expect(voucherConfig(null)).toEqual({ ...VOUCHER_DEFAULTS })
  })

  it("reads integer bounds from metadata (numbers or numeric strings)", () => {
    expect(
      voucherConfig({ voucher_min: "500", voucher_max: 3000, voucher_step: 250 })
    ).toEqual({ min: 500, max: 3000, step: 250, currency: "czk" })
  })

  it("never lets broken metadata open a 1 Kč voucher", () => {
    const config = voucherConfig({
      voucher_min: -5,
      voucher_max: "abc",
      voucher_step: 0.5,
    })
    expect(config.min).toBe(VOUCHER_DEFAULTS.min)
    expect(config.max).toBe(VOUCHER_DEFAULTS.max)
    expect(config.step).toBe(VOUCHER_DEFAULTS.step)
  })

  it("keeps max at or above min", () => {
    const config = voucherConfig({ voucher_min: 20000, voucher_max: 500 })
    expect(config.max).toBeGreaterThanOrEqual(config.min)
  })

  it("reads an optional voucher currency", () => {
    expect(voucherConfig({ voucher_currency: "EUR" }).currency).toBe("eur")
    expect(voucherConfig({ voucher_currency: "koruny" }).currency).toBe("czk")
  })
})

describe("voucher — validateVoucherAmount", () => {
  const config = voucherConfig({})

  it.each([100, 200, 1500, 10000, "2 000", "300"])("accepts %p", (raw) => {
    const result = validateVoucherAmount(raw, config, "czk")
    expect(result.ok).toBe(true)
  })

  it("returns the parsed integer amount", () => {
    expect(validateVoucherAmount("2 500", config, "czk")).toEqual({
      ok: true,
      amount: 2500,
    })
  })

  it.each([
    [undefined, "Zadejte prosím částku"],
    ["", "Zadejte prosím částku"],
    ["sto", "číslem"],
    [150.5, "celých korunách"],
    [0, "od 100 do 10 000 Kč"],
    [1, "od 100 do 10 000 Kč"],
    [10100, "od 100 do 10 000 Kč"],
    [-200, "od 100 do 10 000 Kč"],
    [150, "po 100 Kč"],
  ])("rejects %p with a Czech reason", (raw, reason) => {
    const result = validateVoucherAmount(raw, config, "czk")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain(reason)
  })

  it("counts the step from the minimum", () => {
    const odd = voucherConfig({ voucher_min: 250, voucher_step: 500 })
    expect(validateVoucherAmount(750, odd, "czk").ok).toBe(true)
    expect(validateVoucherAmount(500, odd, "czk").ok).toBe(false)
  })

  it("refuses a cart in another currency", () => {
    const result = validateVoucherAmount(1000, config, "eur")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain("jen v měně Kč")
  })

  it("refuses an unknown cart currency (variant without a price there)", () => {
    expect(validateVoucherAmount(1000, config, "unknown").ok).toBe(false)
  })
})

describe("voucher — voucherLineProblem", () => {
  const productMetadata = { voucher_custom_amount: true }

  it("ignores ordinary products", () => {
    expect(
      voucherLineProblem({
        productMetadata: {},
        itemMetadata: {},
        unitPrice: undefined,
      })
    ).toBeNull()
  })

  it("accepts a line priced at the validated amount", () => {
    expect(
      voucherLineProblem({
        productMetadata,
        itemMetadata: { voucher_amount: 1000 },
        unitPrice: 1000,
        currencyCode: "czk",
      })
    ).toBeNull()
  })

  it("refuses a voucher line added without a price (the standard store route)", () => {
    expect(
      voucherLineProblem({
        productMetadata,
        itemMetadata: { voucher_amount: 1000 },
        unitPrice: undefined,
        currencyCode: "czk",
      })
    ).toContain("ze stránky poukazu")
  })

  it("refuses a price that does not match the chosen amount", () => {
    expect(
      voucherLineProblem({
        productMetadata,
        itemMetadata: { voucher_amount: 1000 },
        unitPrice: 1,
        currencyCode: "czk",
      })
    ).toContain("nesouhlasí")
  })

  it("refuses a missing amount", () => {
    expect(
      voucherLineProblem({
        productMetadata,
        itemMetadata: {},
        unitPrice: 1,
        currencyCode: "czk",
      })
    ).toContain("Zadejte prosím částku")
  })
})
