import { prelozText } from "../lib/admin-cestina"

describe("prelozText — zbytky angličtiny a technické názvy v Medusině adminu", () => {
  it("platební poskytovatele pojmenuje lidsky", () => {
    expect(prelozText("Pp_comgate_comgate")).toBe("Karta (ComGate)")
    expect(prelozText("Pp_dobirka_ceska-Posta")).toBe("Dobírka (Česká pošta)")
    expect(prelozText("Pp_osobni-odber_pickup")).toBe("Platba při osobním odběru")
    expect(prelozText("Pp_system_default")).toBe("Bez online platby")
    // v DOM malými písmeny, velké P dělá až CSS
    expect(prelozText("pp_comgate_comgate")).toBe("Karta (ComGate)")
    expect(prelozText("pp_dobirka_ceska-posta")).toBe("Dobírka (Česká pošta)")
  })

  it("stavy plateb a nepřeložené součty", () => {
    expect(prelozText("Captured")).toBe("Zaplaceno")
    expect(prelozText("Total pending")).toBe("Zbývá zaplatit")
  })

  it("prodejní kanál a země uvnitř věty", () => {
    expect(prelozText("13. 11. 2026 21:31 z Default Sales Channel")).toBe(
      "13. 11. 2026 21:31 z e-shopu"
    )
    expect(prelozText("Czech Republic")).toBe("Česko")
  })

  it("anglické datum a zdvojená měna v platbách", () => {
    expect(prelozText("13 Nov, 2026, 21:31:50")).toBe("13. 11. 2026, 21:31:50")
    expect(prelozText("1 Dec, 2026")).toBe("1. 12. 2026")
    expect(prelozText("Kč 679,00 CZK")).toBe("679,00 Kč")
    expect(prelozText("Kč 1 800,00 CZK")).toBe("1 800,00 Kč")
  })

  it("krátká slova jen jako celý text, ne uvnitř jiného", () => {
    expect(prelozText("Captured payments")).toBeNull()
    expect(prelozText("Objednávka")).toBeNull()
    expect(prelozText("  Captured ")).toBe("  Zaplaceno ")
  })
})

describe("jenServisniRadky — druhá karta Nesplněné položky", () => {
  const { jenServisniRadky } = require("../lib/admin-cestina")
  it("jen balné / doběrečné = servisní karta", () => {
    expect(jenServisniRadky(["↳ Balné", "Doběrečné"])).toBe(true)
    expect(jenServisniRadky(["Balné"])).toBe(true)
  })
  it("s výrobkem nebo prázdná = ne", () => {
    expect(jenServisniRadky(["Keramické pítko", "↳ Balné"])).toBe(false)
    expect(jenServisniRadky([])).toBe(false)
  })
})
