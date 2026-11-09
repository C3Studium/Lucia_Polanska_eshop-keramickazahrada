import { sloucZmeny, vytvorSberac, type Zmeny } from "../url-state"

/**
 * Stav stránky v adrese — a hlavně to, že jedno ťuknutí znamená jeden zápis.
 *
 * Na tom 8. 11. 2026 stála „Kolekce a kategorie": klik na kolekci mění tři
 * klíče najednou a každý z nich zapisoval zvlášť, pokaždé z původní adresy.
 * Poslední zápis vyhrál a byl prázdný, takže klik vybral kolekci a hned ji
 * zase zahodil — zvenčí to vypadalo, že tlačítko nefunguje.
 */

/** Malý plánovač: úlohy se posbírají a test je spustí, až sám chce. */
const frontaPlanovace = () => {
  const ulohy: (() => void)[] = []
  return {
    naplanuj: (uloha: () => void) => {
      ulohy.push(uloha)
    },
    probehni: () => {
      const ted = ulohy.splice(0, ulohy.length)
      for (const uloha of ted) uloha()
    },
  }
}

describe("sloucZmeny", () => {
  it("zapíše hodnotu a prázdnou nebo chybějící smaže", () => {
    const vysledek = sloucZmeny(new URLSearchParams("kategorie=cat_1&druh=bezne"), {
      kolekce: "col_1",
      kategorie: null,
      druh: "",
    })

    expect(vysledek.get("kolekce")).toBe("col_1")
    expect(vysledek.has("kategorie")).toBe(false)
    expect(vysledek.has("druh")).toBe(false)
  })

  it("nesahá na klíče, o kterých změna nemluví", () => {
    const vysledek = sloucZmeny(new URLSearchParams("hledat=mis&razeni=faze"), {
      razeni: "nejnovejsi",
    })

    expect(vysledek.get("hledat")).toBe("mis")
    expect(vysledek.get("razeni")).toBe("nejnovejsi")
  })
})

describe("vytvorSberac", () => {
  it("z jednoho ťuknutí udělá jediný zápis se vším dohromady", () => {
    const planovac = frontaPlanovace()
    const sber = vytvorSberac(planovac.naplanuj)
    const zapsano: Zmeny[] = []
    const zapis = (vse: Zmeny) => zapsano.push(vse)

    /* Klik na kolekci v „Kolekce a kategorie": tři settery za sebou. */
    sber({ kolekce: "col_1" }, zapis)
    sber({ kategorie: null }, zapis)
    sber({ vsekategorie: null }, zapis)
    expect(zapsano).toHaveLength(0)

    planovac.probehni()

    expect(zapsano).toEqual([
      { kolekce: "col_1", kategorie: null, vsekategorie: null },
    ])
  })

  it("kolekce zápis přežije — to byla ta chyba", () => {
    const planovac = frontaPlanovace()
    const sber = vytvorSberac(planovac.naplanuj)
    let adresa = new URLSearchParams("")
    const zapis = (vse: Zmeny) => {
      adresa = sloucZmeny(adresa, vse)
    }

    sber({ kolekce: "col_1" }, zapis)
    sber({ kategorie: null }, zapis)
    sber({ vsekategorie: null }, zapis)
    planovac.probehni()

    expect(adresa.get("kolekce")).toBe("col_1")
  })

  it("pozdější hodnota téhož klíče v jedné dávce vyhrává", () => {
    const planovac = frontaPlanovace()
    const sber = vytvorSberac(planovac.naplanuj)
    const zapsano: Zmeny[] = []
    const zapis = (vse: Zmeny) => zapsano.push(vse)

    sber({ kategorie: "cat_1" }, zapis)
    sber({ kategorie: "cat_2" }, zapis)
    planovac.probehni()

    expect(zapsano).toEqual([{ kategorie: "cat_2" }])
  })

  it("další ťuknutí je nová dávka, ne pokračování té minulé", () => {
    const planovac = frontaPlanovace()
    const sber = vytvorSberac(planovac.naplanuj)
    const zapsano: Zmeny[] = []
    const zapis = (vse: Zmeny) => zapsano.push(vse)

    sber({ kolekce: "col_1" }, zapis)
    planovac.probehni()
    sber({ kategorie: "cat_1" }, zapis)
    planovac.probehni()

    expect(zapsano).toEqual([{ kolekce: "col_1" }, { kategorie: "cat_1" }])
  })
})
