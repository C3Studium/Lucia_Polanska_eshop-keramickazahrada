import { parujRadky } from "../lib/souhrn-odkazy"

describe("řádky Souhrnu ↔ položky objednávky", () => {
  const items = [
    { id: "a", title: "Vlčí mák květ 13cm" },
    { id: "b", title: "Balné — Vlčí mák květ 13cm" },
    { id: "c", title: "Zvonkové tlačítko Lena" },
  ]

  it("páruje podle názvu v pořadí", () => {
    expect(parujRadky(["Vlčí mák květ 13cm", "↳ Balné", "Zvonkové tlačítko Lena"], items)).toEqual(["a", null, "c"])
  })

  it("stejný název dvakrát = dvě různé položky", () => {
    const dva = [
      { id: "x", title: "Pítko" },
      { id: "y", title: "Pítko" },
    ]
    expect(parujRadky(["Pítko", "Pítko"], dva)).toEqual(["x", "y"])
  })

  it("mezery a velikost písmen nevadí, neznámý řádek = null", () => {
    expect(parujRadky(["  vlčí MÁK květ 13cm ", "Něco jiného"], items)).toEqual(["a", null])
  })
})
