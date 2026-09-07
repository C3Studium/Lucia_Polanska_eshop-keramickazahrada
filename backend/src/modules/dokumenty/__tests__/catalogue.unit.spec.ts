import { DOCUMENT_SLOTS, findSlot, missingSlots } from "../catalogue"

describe("katalog dokumentů", () => {
  /* Jméno jde do adresy `/store/documents/:key` a volá se z kódu — diakritika,
     mezery ani velká písmena tam nemají co dělat. */
  it("má jména použitelná v adrese", () => {
    for (const slot of DOCUMENT_SLOTS) {
      expect(slot.key).toMatch(/^[a-z0-9][a-z0-9-]*$/)
      expect(slot.title.trim()).not.toBe("")
      expect(slot.where.trim()).not.toBe("")
    }
  })

  it("najde slot podle jména a na neznámé vrátí null", () => {
    expect(findSlot("reklamacni-formular")?.title).toBe("Formulář k reklamaci")
    expect(findSlot("neexistuje")).toBeNull()
  })

  it("za chybějící považuje slot bez nahraného souboru", () => {
    expect(missingSlots([]).map((slot) => slot.key)).toEqual(
      DOCUMENT_SLOTS.map((slot) => slot.key)
    )

    expect(missingSlots(DOCUMENT_SLOTS.map(({ key }) => ({ key })))).toEqual([])
  })

  /* Povinné napřed: Přehled vypisuje prvních pár a nepovinný dokument nemá
     zakrýt ten, kvůli kterému se na webu něco nezobrazí. */
  it("řadí povinné před nepovinné", () => {
    const poradi = missingSlots([]).map((slot) => slot.required)

    expect([...poradi].sort((a, b) => Number(b) - Number(a))).toEqual(poradi)
  })

  /* Jméno je API: kdo ho přejmenuje, rozbije `getSiteDocument` na potvrzení
     objednávky i všechno, co je v administraci nahrané pod tím starým. */
  it("drží jméno formuláře k reklamaci", () => {
    expect(findSlot("reklamacni-formular")).not.toBeNull()
  })
})
