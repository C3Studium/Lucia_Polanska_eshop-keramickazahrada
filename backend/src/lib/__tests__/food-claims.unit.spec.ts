import { stripFoodClaims } from "../../scripts/food-claims"

describe("tvrzení o nezávadnosti v popisu (LEGAL_AUDIT § 0b N1)", () => {
  it("odstraní celé věty s tvrzením a zbytek popisu nechá", () => {
    const { next, removed } = stripFoodClaims(
      "Ručně točené pítko.\n\nPoužité glazury jsou zdravotně nezávadné.\n\nRozměry: průměr cca 23 cm."
    )
    expect(removed).toEqual(["Použité glazury jsou zdravotně nezávadné."])
    expect(next).toBe("Ručně točené pítko.\n\nRozměry: průměr cca 23 cm.")
  })

  it("větu v závorce uprostřed odstavce vyřízne jen po tečku", () => {
    const { next, removed } = stripFoodClaims(
      "Může sloužit i jako dekorativní mísa (použité materiály jsou zdravotně nezávadné). Fotky jsou ilustrační."
    )
    expect(removed.length).toBe(1)
    expect(next).toContain("Fotky jsou ilustrační.")
    expect(next).not.toMatch(/nezávadn/)
  })

  it("negaci („není vhodný pro styk s potravinami“) nechá — to je upozornění, ne tvrzení", () => {
    const text = "Hrnek s ptáčkem je dekorace, není určen pro konzumaci nápojů, není vhodný pro styk s potravinami."
    const { next, removed } = stripFoodClaims(text)
    expect(removed).toEqual([])
    expect(next).toBe(text)
  })

  it("popis bez tvrzení vrátí beze změny", () => {
    const { next, removed } = stripFoodClaims("Mrazuvzdorný květináč, průměr 20 cm.")
    expect(removed).toEqual([])
    expect(next).toBe("Mrazuvzdorný květináč, průměr 20 cm.")
  })
})
