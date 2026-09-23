import {
  DOBIRKA_FEE_MARKER,
  dobirkaFeeApplies,
  dobirkaFeeCompletionProblem,
  isDobirkaFeeLine,
  planDobirkaFee,
} from "../dobirka-fee"
import { DOBIRKA_PROVIDER_ID } from "../ship-gate"

const feeLine = (overrides: Record<string, unknown> = {}) => ({
  id: "li_fee",
  quantity: 1,
  unit_price: 39,
  metadata: { [DOBIRKA_FEE_MARKER]: true },
  ...overrides,
})

const productLine = (overrides: Record<string, unknown> = {}) => ({
  id: "li_prod",
  quantity: 2,
  unit_price: 450,
  metadata: {},
  variant_id: "variant_1",
  product_id: "prod_1",
  ...overrides,
})

/** The attack: a real product line with a client-forged `dobirka_fee` marker.
    Every store route that can create or edit a line accepts `metadata`, so
    the marker is forgeable — but a `variant_id` is mandatory on all of them,
    while the real fee line has none. */
const forgedLine = (overrides: Record<string, unknown> = {}) =>
  productLine({
    id: "li_forged",
    quantity: 1,
    unit_price: 2000,
    metadata: { [DOBIRKA_FEE_MARKER]: true },
    ...overrides,
  })

describe("isDobirkaFeeLine", () => {
  it("requires the marker AND no product behind the line", () => {
    expect(isDobirkaFeeLine(feeLine())).toBe(true)
    expect(isDobirkaFeeLine(productLine())).toBe(false)
    expect(isDobirkaFeeLine({ metadata: null })).toBe(false)
    expect(isDobirkaFeeLine(null)).toBe(false)
    // A title alone must never make something a fee line — titles are copy.
    expect(isDobirkaFeeLine({ metadata: {}, id: "x" })).toBe(false)
  })

  it("treats a forged marker on a variant line as an ordinary product", () => {
    // Marker forged through client-writable metadata: still not a fee line.
    expect(isDobirkaFeeLine(forgedLine())).toBe(false)
    expect(isDobirkaFeeLine(forgedLine({ product_id: null }))).toBe(false)
    expect(isDobirkaFeeLine(forgedLine({ variant_id: null }))).toBe(false)
  })
})

describe("fee-marker forgery — the 39Kč-vase attack", () => {
  it("planDobirkaFee never re-prices a forged line; it adds the real fee", () => {
    const plan = planDobirkaFee({
      providerId: DOBIRKA_PROVIDER_ID,
      currencyCode: "czk",
      feeCzk: 39,
      items: [forgedLine()],
    })
    // The forged 2000Kč line is untouched — no update to 39, no removal.
    expect(plan.update).toBeNull()
    expect(plan.remove_ids).toEqual([])
    // And the real fee still gets added.
    expect(plan.add).toEqual({ unit_price: 39 })
  })

  it("completion treats the forged line as a product, not as the fee", () => {
    // Dobírka cart holding only the forged line: the real fee is missing.
    expect(
      dobirkaFeeCompletionProblem({
        usesDobirka: true,
        currencyCode: "czk",
        feeCzk: 39,
        items: [forgedLine()],
      })
    ).toMatch(/doběrečné/i)
    // With the real fee alongside, the forged line is just another item.
    expect(
      dobirkaFeeCompletionProblem({
        usesDobirka: true,
        currencyCode: "czk",
        feeCzk: 39,
        items: [forgedLine(), feeLine()],
      })
    ).toBeNull()
  })
})

describe("dobirkaFeeApplies", () => {
  it("requires dobírka, CZK and a positive amount — all three", () => {
    const base = { usesDobirka: true, currencyCode: "czk", feeCzk: 39 }
    expect(dobirkaFeeApplies(base)).toBe(true)
    expect(dobirkaFeeApplies({ ...base, usesDobirka: false })).toBe(false)
    expect(dobirkaFeeApplies({ ...base, currencyCode: "eur" })).toBe(false)
    expect(dobirkaFeeApplies({ ...base, feeCzk: 0 })).toBe(false)
    // Casing of the currency code is presentation, not meaning.
    expect(dobirkaFeeApplies({ ...base, currencyCode: "CZK" })).toBe(true)
  })
})

describe("planDobirkaFee — the payment-session trigger", () => {
  const dobirka = {
    providerId: DOBIRKA_PROVIDER_ID,
    currencyCode: "czk",
    feeCzk: 39,
  }

  it("adds exactly one fee line when dobírka is chosen and none exists", () => {
    const plan = planDobirkaFee({ ...dobirka, items: [productLine()] })
    expect(plan.add).toEqual({ unit_price: 39 })
    expect(plan.remove_ids).toEqual([])
    expect(plan.update).toBeNull()
  })

  it("is idempotent: a correct cart produces an empty plan", () => {
    const plan = planDobirkaFee({
      ...dobirka,
      items: [productLine(), feeLine()],
    })
    expect(plan).toEqual({ add: null, remove_ids: [], update: null })
  })

  it("removes the fee when the customer switches away from dobírka", () => {
    const plan = planDobirkaFee({
      providerId: "pp_comgate_comgate",
      currencyCode: "czk",
      feeCzk: 39,
      items: [productLine(), feeLine()],
    })
    expect(plan.add).toBeNull()
    expect(plan.remove_ids).toEqual(["li_fee"])
  })

  it("collapses duplicate fee lines down to one", () => {
    const plan = planDobirkaFee({
      ...dobirka,
      items: [feeLine({ id: "li_a" }), feeLine({ id: "li_b" }), feeLine({ id: "li_c" })],
    })
    expect(plan.add).toBeNull()
    expect(plan.remove_ids).toEqual(["li_b", "li_c"])
    expect(plan.update).toBeNull()
  })

  it("re-prices the surviving line when the setting changed before selection", () => {
    const plan = planDobirkaFee({
      ...dobirka,
      feeCzk: 49,
      items: [feeLine({ unit_price: 39 })],
    })
    expect(plan.update).toEqual({ id: "li_fee", unit_price: 49 })
    expect(plan.add).toBeNull()
  })

  it("fixes a drifted quantity back to one", () => {
    const plan = planDobirkaFee({
      ...dobirka,
      items: [feeLine({ quantity: 3 })],
    })
    expect(plan.update).toEqual({ id: "li_fee", unit_price: 39 })
  })

  it("removes the fee entirely when the owner set it to zero", () => {
    const plan = planDobirkaFee({
      ...dobirka,
      feeCzk: 0,
      items: [feeLine()],
    })
    expect(plan.add).toBeNull()
    expect(plan.remove_ids).toEqual(["li_fee"])
  })

  it("never puts a CZK fee on a non-CZK cart", () => {
    const plan = planDobirkaFee({
      ...dobirka,
      currencyCode: "eur",
      items: [productLine()],
    })
    expect(plan.add).toBeNull()
  })
})

describe("dobirkaFeeCompletionProblem — the validate-dobirka backstop", () => {
  const base = { usesDobirka: true, currencyCode: "czk", feeCzk: 39 }

  it("accepts the expected shape: dobírka with exactly one fee line", () => {
    expect(
      dobirkaFeeCompletionProblem({ ...base, items: [productLine(), feeLine()] })
    ).toBeNull()
  })

  it("refuses a dobírka cart whose fee line is missing", () => {
    expect(
      dobirkaFeeCompletionProblem({ ...base, items: [productLine()] })
    ).toMatch(/doběrečné/i)
  })

  it("refuses a fee that survived a switch away from dobírka (off-guard)", () => {
    expect(
      dobirkaFeeCompletionProblem({
        ...base,
        usesDobirka: false,
        items: [productLine(), feeLine()],
      })
    ).toMatch(/doběrečné/i)
  })

  it("accepts a plain card cart without a fee", () => {
    expect(
      dobirkaFeeCompletionProblem({
        ...base,
        usesDobirka: false,
        items: [productLine()],
      })
    ).toBeNull()
  })

  it("refuses duplicated fee lines and a drifted quantity", () => {
    expect(
      dobirkaFeeCompletionProblem({
        ...base,
        items: [feeLine({ id: "a" }), feeLine({ id: "b" })],
      })
    ).toMatch(/vícekrát/)
    expect(
      dobirkaFeeCompletionProblem({ ...base, items: [feeLine({ quantity: 2 })] })
    ).toMatch(/vícekrát/)
  })

  it("does not demand a fee when the owner disabled it (zero)", () => {
    expect(
      dobirkaFeeCompletionProblem({ ...base, feeCzk: 0, items: [productLine()] })
    ).toBeNull()
  })

  it("keeps honoring a fee the customer already agreed to after the owner zeroed the setting", () => {
    // The price on screen is a promise; changing the setting mid-checkout
    // must never brick the order in flight.
    expect(
      dobirkaFeeCompletionProblem({ ...base, feeCzk: 0, items: [feeLine()] })
    ).toBeNull()
  })

  it("does not compare the fee's price against the current setting", () => {
    expect(
      dobirkaFeeCompletionProblem({
        ...base,
        feeCzk: 49,
        items: [feeLine({ unit_price: 39 })],
      })
    ).toBeNull()
  })
})
