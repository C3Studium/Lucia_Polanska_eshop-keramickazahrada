import { DOCUMENT_SLOTS, findSlot, missingSlots } from "../catalogue"

describe("katalog dokumentů", () => {
  /* Jméno jde do adresy `/store/documents/:key` a volá se z kódu — diakritika,
     mezery ani velká písmena tam nemají co dělat. Platí pro každý slot, který
     se sem kdy přidá; dnes je katalog prázdný (viz komentář v `catalogue.ts`). */
  it("má jména použitelná v adrese", () => {
    for (const slot of DOCUMENT_SLOTS) {
      expect(slot.key).toMatch(/^[a-z0-9][a-z0-9-]*$/)
      expect(slot.title.trim()).not.toBe("")
      expect(slot.where.trim()).not.toBe("")
    }
  })

  it("na neznámé jméno vrátí null", () => {
    expect(findSlot("neexistuje")).toBeNull()
    expect(findSlot("reklamacni-formular")).toBeNull()
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

  /* Prázdný katalog nesmí nic rozsvítit: Přehled by hlásil chybějící dokument,
     který se nemá kam nahrát, a administrace by u „Dokumentů" ukazovala
     prázdný povinný blok. Vlastní dokumenty jdou nahrávat dál. */
  it("prázdný katalog nehlásí nic chybějícího", () => {
    expect(missingSlots([])).toEqual([])
    expect(missingSlots([{ key: "cokoli-vlastniho" }])).toEqual([])
  })
})
