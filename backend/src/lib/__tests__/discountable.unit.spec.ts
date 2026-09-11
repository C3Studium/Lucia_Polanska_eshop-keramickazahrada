import {
  noSaleMembership,
  rozdilyDiscountable,
  smiDostatSlevu,
  type DiscountableProduct,
  type SaleMembership,
} from "../discountable"

const vAkci = (ids: string[]): SaleMembership => ({
  saleProductIds: new Set(ids),
})

const produkt = (
  id: string,
  overrides: Partial<DiscountableProduct> = {}
): DiscountableProduct => ({ id, ...overrides })

describe("smiDostatSlevu", () => {
  it("běžný kus za plnou cenu slevový kód přijme", () => {
    expect(smiDostatSlevu(produkt("prod_1"))).toBe(true)
  })

  it("kus ve výprodeji ne — cena už je stažená", () => {
    expect(
      smiDostatSlevu(produkt("prod_1", { metadata: { clearance: true } }))
    ).toBe(false)
  })

  it("kus v běžící sezónní akci ne", () => {
    expect(smiDostatSlevu(produkt("prod_1"), vAkci(["prod_1"]))).toBe(false)
  })

  it("kus v akci, do které nepatří, ano", () => {
    expect(smiDostatSlevu(produkt("prod_1"), vAkci(["prod_2"]))).toBe(true)
  })

  it("`clearance: false` není výprodej", () => {
    expect(
      smiDostatSlevu(produkt("prod_1", { metadata: { clearance: false } }))
    ).toBe(true)
  })

  it("produkt bez id nerozhoduje nic", () => {
    expect(smiDostatSlevu({ id: "" })).toBe(false)
  })
})

describe("rozdilyDiscountable", () => {
  it("zlevněný kus, který slevu ještě pouští, se vypne", () => {
    const vysledek = rozdilyDiscountable([
      produkt("prod_1", { metadata: { clearance: true }, discountable: true }),
    ])

    expect(vysledek).toEqual({ zapnout: [], vypnout: ["prod_1"] })
  })

  it("kus, který se vrátil k plné ceně, se zase zapne", () => {
    const vysledek = rozdilyDiscountable([
      produkt("prod_1", { discountable: false }),
    ])

    expect(vysledek).toEqual({ zapnout: ["prod_1"], vypnout: [] })
  })

  it("už správně nastavený katalog nevyvolá žádný zápis", () => {
    const vysledek = rozdilyDiscountable(
      [
        produkt("prod_1", { discountable: true }),
        produkt("prod_2", {
          metadata: { clearance: true },
          discountable: false,
        }),
      ],
      noSaleMembership
    )

    expect(vysledek).toEqual({ zapnout: [], vypnout: [] })
  })

  it("chybějící `discountable` se čte jako zapnuto — to je výchozí stav Medusy", () => {
    /* Kdyby se `undefined` četlo jako vypnuto, každý běžný produkt katalogu by
       si při prvním přejezdu vyžádal zbytečný zápis. */
    expect(rozdilyDiscountable([produkt("prod_1")])).toEqual({
      zapnout: [],
      vypnout: [],
    })
  })

  it("položky bez id se přeskočí, zbytek se dořeší", () => {
    const vysledek = rozdilyDiscountable([
      { id: "" } as DiscountableProduct,
      produkt("prod_2", { discountable: true }),
    ], vAkci(["prod_2"]))

    expect(vysledek).toEqual({ zapnout: [], vypnout: ["prod_2"] })
  })
})
