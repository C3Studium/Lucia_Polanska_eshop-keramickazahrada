import {
  clampContractPercentage,
  contractDepositAmountOf,
  contractDepositOf,
} from "../made-to-order/contract-deposit"
import {
  DEPOSIT_RANGE_MESSAGE,
  validateProductionProfile,
  VARIANT_DEPOSIT_RANGE_MESSAGE,
} from "../made-to-order/profile-validation"

/**
 * LEGAL_AUDIT.md § 0, Z2: záloha nejvýš 50 % — profil, přebití provedení i
 * pokladna. A smluvní záloha ≠ zaplaceno (podklad pro Z5).
 */

describe("validateProductionProfile — strop 50 % (Z2)", () => {
  it("profil: 1–50 projde, 0 / 51 / 100 ne", () => {
    expect(validateProductionProfile({ default_deposit_percentage: 1 })).toEqual({ ok: true })
    expect(validateProductionProfile({ default_deposit_percentage: 50 })).toEqual({ ok: true })
    expect(validateProductionProfile({ default_deposit_percentage: 0 })).toEqual({
      ok: false,
      message: DEPOSIT_RANGE_MESSAGE,
    })
    expect(validateProductionProfile({ default_deposit_percentage: 51 })).toEqual({
      ok: false,
      message: DEPOSIT_RANGE_MESSAGE,
    })
    expect(validateProductionProfile({ default_deposit_percentage: 100 }).ok).toBe(false)
    expect(DEPOSIT_RANGE_MESSAGE).toMatch(/1 a 50 %/)
  })

  it("přebití u provedení: null = bez přebití, 60 odmítne", () => {
    expect(
      validateProductionProfile({ variants: [{ deposit_percentage_override: null }] })
    ).toEqual({ ok: true })
    expect(
      validateProductionProfile({ variants: [{ deposit_percentage_override: 40 }] })
    ).toEqual({ ok: true })
    expect(
      validateProductionProfile({ variants: [{ deposit_percentage_override: 60 }] })
    ).toEqual({ ok: false, message: VARIANT_DEPOSIT_RANGE_MESSAGE })
  })

  it("doba výroby: min ≤ max, celá nezáporná čísla", () => {
    expect(
      validateProductionProfile({ production_time_min_days: 30, production_time_max_days: 14 }).ok
    ).toBe(false)
    expect(validateProductionProfile({ production_time_min_days: 1.5 }).ok).toBe(false)
    expect(
      validateProductionProfile({ production_time_min_days: 14, production_time_max_days: 42 })
    ).toEqual({ ok: true })
  })
})

describe("clampContractPercentage", () => {
  it("sevře do 1–50, nesmysl → výchozí 25", () => {
    expect(clampContractPercentage(100)).toBe(50)
    expect(clampContractPercentage(0)).toBe(25)
    expect(clampContractPercentage(null)).toBe(25)
    expect(clampContractPercentage("30")).toBe(30)
    expect(clampContractPercentage(0.5)).toBe(1)
    expect(clampContractPercentage(undefined, 40)).toBe(40)
  })
})

describe("contractDepositOf — smluvní záloha z řádků pokladny", () => {
  it("jeden řádek se snímkem: částka i procento ze snímku, i když zákazník zaplatil vše", () => {
    const lines = [
      {
        product_id: "prod_1",
        line_total: 5000,
        // posuvník přepsal deposit_* na 100 % — smluvní snímek zůstává
        deposit_percentage: 100,
        deposit_amount: 5000,
        contract_deposit_percentage: 25,
        contract_deposit_amount: 1250,
        contract_line_base: 5000,
      },
    ]
    expect(contractDepositOf(lines)).toEqual({
      percentage: 25,
      amount: 1250,
      from_snapshot: true,
    })
  })

  it("víc řádků: vážený průměr Σ záloh / Σ základů, na 2 desetinná místa", () => {
    const lines = [
      { line_total: 1000, contract_deposit_percentage: 20, contract_deposit_amount: 200, contract_line_base: 1000 },
      { line_total: 3000, contract_deposit_percentage: 50, contract_deposit_amount: 1500, contract_line_base: 3000 },
    ]
    // 1700 / 4000 = 42.5 %
    expect(contractDepositOf(lines)).toEqual({ percentage: 42.5, amount: 1700, from_snapshot: true })
  })

  it("záloha ze zlevněného řádku seříznutá na cenu → procento přes základ nikdy nad 50", () => {
    const lines = [
      { line_total: 400, contract_deposit_percentage: 50, contract_deposit_amount: 400, contract_line_base: 1000 },
    ]
    expect(contractDepositOf(lines)).toEqual({ percentage: 40, amount: 400, from_snapshot: true })
  })

  it("stará kolekce bez snímku: procento z profilu (nikdy 100), částka = Σ line_total × %", () => {
    const legacy = [{ line_total: 2479, deposit_percentage: 100, deposit_amount: 2479 }]
    expect(contractDepositOf(legacy, 25)).toEqual({
      percentage: 25,
      amount: 619.75,
      from_snapshot: false,
    })
    expect(contractDepositOf(legacy, 100).percentage).toBe(50)
    expect(contractDepositOf(legacy, undefined).percentage).toBe(25)
  })

  it("prázdno → výchozí procento, nulová částka", () => {
    expect(contractDepositOf([])).toEqual({ percentage: 25, amount: 0, from_snapshot: false })
    expect(contractDepositOf(null)).toEqual({ percentage: 25, amount: 0, from_snapshot: false })
  })
})

describe("contractDepositAmountOf — z uložené zakázky", () => {
  it("deposit_amount má přednost (i BigNumber tvar)", () => {
    expect(
      contractDepositAmountOf({ deposit_amount: { value: "1250" }, deposit_percentage: 100, original_total: 5000 })
    ).toBe(1250)
    expect(contractDepositAmountOf({ deposit_amount: 0, deposit_percentage: 25, original_total: 5000 })).toBe(0)
  })

  it("stará zakázka (null): original_total × procento, sevřené na 50 %", () => {
    expect(contractDepositAmountOf({ deposit_amount: null, deposit_percentage: 25, original_total: 5000 })).toBe(
      1250
    )
    // „zaplaceno 100 %" ve starém sloupci nesmí znamenat zálohu 100 %
    expect(contractDepositAmountOf({ deposit_amount: null, deposit_percentage: 100, original_total: 5000 })).toBe(
      2500
    )
  })
})
