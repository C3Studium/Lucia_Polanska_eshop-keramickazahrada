import { ceskaChyba, ceskyText } from "../ceska-chyba"

describe("ceskaChyba", () => {
  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => undefined))
  afterEach(() => jest.restoreAllMocks())

  it("keeps a Czech message from our own routes untouched", () => {
    expect(ceskaChyba(new Error("Zakázka nemá žádný příplatek."), "Akce se nepodařila.")).toBe(
      "Zakázka nemá žádný příplatek."
    )
  })

  it("translates English Medusa / browser errors after the caller's fallback", () => {
    expect(ceskaChyba(new Error("Failed to fetch"), "Uložení se nepodařilo.")).toBe(
      "Uložení se nepodařilo. Nepodařilo se spojit se serverem — zkontrolujte připojení a zkuste to znovu."
    )
    expect(ceskaChyba(new Error("Product with id: prod_1 was not found"), "Smazání se nepodařilo")).toBe(
      "Smazání se nepodařilo. Záznam už neexistuje — obnovte prosím stránku."
    )
    expect(
      ceskaChyba(new Error("Invalid request: Expected type: 'number' for field 'amount'"), "Uložení se nepodařilo.")
    ).toBe("Uložení se nepodařilo. Některý údaj chybí nebo má špatný tvar.")
    expect(ceskaChyba({ message: "Unauthorized" }, "Nepodařilo se.")).toBe(
      "Nepodařilo se. Přihlášení vypršelo — přihlaste se prosím znovu."
    )
  })

  it("falls back to the Czech text for unknown English and for empty errors", () => {
    expect(ceskaChyba(new Error("Something odd happened"), "Změna se nepodařila.")).toBe("Změna se nepodařila.")
    expect(ceskaChyba(undefined, "Změna se nepodařila.")).toBe("Změna se nepodařila.")
    expect(ceskaChyba(new Error(""), "Změna se nepodařila.")).toBe("Změna se nepodařila.")
  })

  it("ceskyText guards plain server messages the same way", () => {
    expect(ceskyText("Dobropis vystaven.", "Hotovo.")).toBe("Dobropis vystaven.")
    expect(ceskyText(undefined, "Hotovo.")).toBe("Hotovo.")
    expect(ceskyText("Refund created", "Peníze byly vráceny.")).toBe("Peníze byly vráceny.")
  })
})
