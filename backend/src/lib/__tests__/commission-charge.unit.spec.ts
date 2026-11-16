import { commissionCharge } from "../deposit-split"

/**
 * Kolik se u zakázky strhne hned — tatáž funkce pro pokladnu i pro platbu.
 *
 * 16. 11. 2026: objednávka #77 (zakázka 4 300 + balné 50, zvonek 1 450,
 * růže 110, Česká Pošta - Křehké 150). Pokladna slibovala 2 835, brána
 * strhla 2 685: pravidlo z 31. 10. („s běžným zbožím se poštovné platí hned")
 * dostal jen výpočet pro pokladnu, platba ho neznala.
 */
describe("commissionCharge", () => {
  const order77 = {
    cartTotal: 6060,
    shipping: 150,
    productionTotal: 4300,
    lines: [{ floor: 1075, ceiling: 4300 }],
    hasPlainGoods: true,
  }

  it("míchaný košík: běžné zboží celé + poštovné + záloha (#77 = 2 835)", () => {
    expect(commissionCharge({ ...order77, target: "deposit" }).chargeNow).toBe(2835)
  })

  it("míchaný košík: zaplatit vše = celý košík", () => {
    expect(commissionCharge({ ...order77, target: "full" }).chargeNow).toBe(6060)
  })

  it("jen zakázka: poštovné až v doplatku (#74 = 1 125)", () => {
    const result = commissionCharge({
      cartTotal: 4500,
      shipping: 150,
      productionTotal: 4300,
      lines: [{ floor: 1075, ceiling: 4300 }],
      hasPlainGoods: false,
      target: "deposit",
    })
    expect(result.chargeNow).toBe(1125)
    expect(result.maximum).toBe(4500)
  })

  it("posuvník se sevře do [minimum, maximum]", () => {
    const low = commissionCharge({ ...order77, target: 100 })
    const high = commissionCharge({ ...order77, target: 99999 })
    expect(low.chargeNow).toBe(2835)
    expect(high.chargeNow).toBe(6060)
  })
})
