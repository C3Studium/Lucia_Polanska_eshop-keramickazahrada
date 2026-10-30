import { resolveAgreedDeposit } from "../made-to-order/agreed-price"
import { commissionMoney, agreedExtrasTotal } from "../made-to-order/commission-money"
import { productionOutstanding } from "../ship-gate"

describe("resolveAgreedDeposit — záloha se domlouvá v korunách", () => {
  it("zadaná částka platí a procento se dopočítá", () => {
    expect(
      resolveAgreedDeposit({ agreedTotal: 2500, depositAmount: 1000 })
    ).toEqual({ amount: 1000, percentage: 40 })
  })

  it("strop je polovina ceny VÝROBKU (Z2)", () => {
    expect(
      resolveAgreedDeposit({ agreedTotal: 2000, depositAmount: 1000 }).amount
    ).toBe(1000)
    expect(() =>
      resolveAgreedDeposit({ agreedTotal: 2000, depositAmount: 1001 })
    ).toThrow(/nejvýš polovina/)
  })

  it("nulová ani záporná záloha neprojde", () => {
    for (const amount of [0, -100]) {
      expect(() =>
        resolveAgreedDeposit({ agreedTotal: 2000, depositAmount: amount })
      ).toThrow(/kladná částka/)
    }
  })

  it("bez částky se počítá po staru z procenta", () => {
    expect(
      resolveAgreedDeposit({ agreedTotal: 2000, depositPercentage: 25 })
    ).toEqual({ amount: 500, percentage: 25 })
    // Bez obojího spadne na uložené procento profilu.
    expect(
      resolveAgreedDeposit({ agreedTotal: 2000, storedPercentage: 30 })
    ).toEqual({ amount: 600, percentage: 30 })
  })

  it("drobná záloha se zaokrouhlí na procento v mezích, ne na nulu", () => {
    const { amount, percentage } = resolveAgreedDeposit({
      agreedTotal: 10000,
      depositAmount: 50,
    })
    expect(amount).toBe(50)
    // 0,5 % → zaokrouhlení dolů dá 0, meze profilu ho zvednou na 1.
    expect(percentage).toBe(1)
  })
})

describe("poštovné a balné domluvené s cenou", () => {
  const commission = {
    id: "po_1",
    stage: "confirmed",
    line_item_id: "li_1",
    line_total: 0,
    original_total: 0,
    agreed_total: 2500,
    shipping_total: 150,
    packaging_total: 100,
  }

  it("navyšují, co zákazník dluží", () => {
    expect(productionOutstanding({ ...commission, payment_requests: [] })).toBe(2750)
  })

  it("zaplacená záloha se od dluhu odečte", () => {
    expect(
      productionOutstanding({
        ...commission,
        payment_requests: [{ status: "paid", amount: 1000 }],
      })
    ).toBe(1750)
  })

  it("cenu výrobku nemění — záloha se počítá jen z ní", () => {
    const money = commissionMoney(commission, [])
    expect(money.item_total).toBe(2500)
    expect(agreedExtrasTotal(commission)).toBe(250)
    // „Navíc" patří objednávce, ne položce.
    expect(money.extras_total).toBe(250)
    expect(money.item_outstanding).toBe(2500)
  })

  it("bez nich zůstává všechno jako dřív", () => {
    const bez = { ...commission, shipping_total: null, packaging_total: null }
    expect(productionOutstanding({ ...bez, payment_requests: [] })).toBe(2500)
    expect(commissionMoney(bez, []).extras_total).toBe(0)
  })

  it("zrušená zakázka nedluží ani poštovné", () => {
    expect(
      productionOutstanding({ ...commission, stage: "cancelled", payment_requests: [] })
    ).toBe(0)
  })
})
