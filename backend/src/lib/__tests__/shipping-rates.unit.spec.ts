import {
  shippingClassOf,
  shipmentPrice,
  type ShippingRates,
} from "../shipping-rates"

/**
 * Cena dopravy podle velikosti zásilky a křehkosti (16. 11. 2026, Matěj).
 *
 * Základ = malá / velká zásilka dopravce (jediný velký kus dělá celou
 * zásilku velkou), čisté poukazy mají vlastní cenu, a když je v balíku
 * cokoli křehkého, přičte se příplatek za křehké. Doběrečné je zvlášť
 * (řádek objednávky), sem nepatří.
 */
const posta: ShippingRates = { small: 90, large: 130, fragile: 60, poukaz: 70 }
const line = (ship_class?: string, ship_fragile = false, extra: Record<string, unknown> = {}) => ({
  quantity: 1,
  metadata: { ...(ship_class ? { ship_class } : {}), ship_fragile, ...extra },
})

describe("shippingClassOf", () => {
  it("bere uloženou třídu", () => {
    expect(shippingClassOf({ shipping_class: "velke" })).toBe("velke")
    expect(shippingClassOf({ shipping_class: "poukaz" })).toBe("poukaz")
  })
  it("bez třídy: poukaz u dárkového poukazu, jinak malé", () => {
    expect(shippingClassOf({ gift_voucher: true })).toBe("poukaz")
    expect(shippingClassOf({})).toBe("male")
    expect(shippingClassOf({ shipping_class: "nesmysl" })).toBe("male")
  })
})

describe("shipmentPrice", () => {
  it("malá zásilka = malá cena", () => {
    expect(shipmentPrice(posta, [line("male"), line("male")])).toBe(90)
  })
  it("jeden velký kus = velká zásilka", () => {
    expect(shipmentPrice(posta, [line("male"), line("velke")])).toBe(130)
  })
  it("křehký kus přidá příplatek", () => {
    expect(shipmentPrice(posta, [line("male", true)])).toBe(150)
    expect(shipmentPrice(posta, [line("velke"), line("male", true)])).toBe(190)
  })
  it("jen poukazy = cena poukazu; s výrobkem rozhoduje výrobek", () => {
    expect(shipmentPrice(posta, [line("poukaz")])).toBe(70)
    expect(shipmentPrice(posta, [line("poukaz"), line("male")])).toBe(90)
  })
  it("balné a doběrečné do zásilky nepočítá", () => {
    expect(
      shipmentPrice(posta, [line("male"), line(undefined, false, { packaging_fee: true }), line(undefined, false, { dobirka_fee: true })])
    ).toBe(90)
  })
  it("řádek bez razítka = malé, nekřehké", () => {
    expect(shipmentPrice(posta, [{ quantity: 1, metadata: {} }])).toBe(90)
  })
  it("chybějící cena poukazu spadne na malou", () => {
    expect(shipmentPrice({ small: 60, large: 90 }, [line("poukaz")])).toBe(60)
  })
})

describe("isBalikovnaPickupMethod", () => {
  const { isBalikovnaPickupMethod } = require("../shipping-rates")
  it("výdejní místo podle id i podle názvu", () => {
    expect(isBalikovnaPickupMethod({ name: "Balíkovna", data: { id: "balikovna" } })).toBe(true)
    expect(isBalikovnaPickupMethod({ name: "Balíkovna" })).toBe(true)
  })
  it("Balíkovna na adresu výdejní místo NENÍ (adresa se nesmí přepsat)", () => {
    expect(isBalikovnaPickupMethod({ name: "Balíkovna na adresu", data: { id: "balikovna-address" } })).toBe(false)
    expect(isBalikovnaPickupMethod({ name: "Balíkovna na adresu" })).toBe(false)
  })
  it("Česká pošta ani odběr nejsou Balíkovna", () => {
    expect(isBalikovnaPickupMethod({ name: "Česká Pošta", data: { id: "cp-address" } })).toBe(false)
    expect(isBalikovnaPickupMethod({ name: "Osobní odběr" })).toBe(false)
  })
})

describe("shippingClassOf — poukaz s vlastní částkou", () => {
  it("bez uložené třídy je to poukaz", () => {
    const { VOUCHER_FLAG } = require("../voucher")
    expect(shippingClassOf({ [VOUCHER_FLAG]: true })).toBe("poukaz")
  })
})
