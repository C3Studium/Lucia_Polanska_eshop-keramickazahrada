/**
 * IČO a DIČ — jedna sada pravidel pro formulář i pro server.
 *
 * Schválně bez `server-only`: formulář potřebuje odezvu při psaní a serverová
 * akce potřebuje poslední slovo. Kdyby to byly dva kusy kódu, rozejdou se —
 * a rozejdou se tiše, protože klientská kontrola projde a serverová odmítne
 * bez vysvětlení.
 */

/** Vyhodí z čísla mezery a nedělitelné mezery, které lidé lepí po trojicích. */
const jenCislice = (hodnota: string) => hodnota.replace(/[\s\u00A0]/g, "")

/**
 * IČO má osm číslic a poslední z nich je kontrolní.
 *
 * Algoritmus je modulo 11 s vahami 8…2: sečte se sedm číslic vynásobených
 * vahami, zbytek po dělení jedenácti se odečte od jedenácti a výsledek modulo
 * deset je kontrolní číslice. Bez téhle kontroly projde každé osmimístné
 * číslo, tedy i překlep — a na faktuře s chybným IČO je problém, který se
 * pozná až u účetní.
 */
export const platneIco = (hodnota: string): boolean => {
  const ico = jenCislice(hodnota)

  if (!/^\d{8}$/.test(ico)) {
    return false
  }

  let soucet = 0
  for (let i = 0; i < 7; i++) {
    soucet += Number(ico[i]) * (8 - i)
  }

  const zbytek = soucet % 11
  const kontrolni = (11 - zbytek) % 10

  return kontrolni === Number(ico[7])
}

/**
 * DIČ české firmy je „CZ" a osm až deset číslic.
 *
 * Osm u právnických osob (shoduje se s IČO), devět nebo deset u fyzických
 * (rodné číslo). Kontrolní součet se tu nepočítá: u rodného čísla by to
 * znamenalo ověřovat datum narození, což do e-shopu nepatří.
 *
 * Prázdné DIČ je platné — neplátce DPH ho nemá a nutit ho vymýšlet by bylo
 * horší než ho nemít.
 */
export const platneDic = (hodnota: string): boolean => {
  const dic = jenCislice(hodnota).toUpperCase()

  if (!dic) {
    return true
  }

  return /^CZ\d{8,10}$/.test(dic)
}

/** Tvar, ve kterém se obojí ukládá — bez mezer, DIČ velkými písmeny. */
export const normalizujIco = (hodnota: string) => jenCislice(hodnota)
export const normalizujDic = (hodnota: string) =>
  jenCislice(hodnota).toUpperCase()

/**
 * Ověří firemní část objednávky a vrátí českou hlášku, nebo `null`.
 *
 * Název a IČO jsou povinné, jakmile člověk řekne, že nakupuje na firmu:
 * bez nich nejde vystavit doklad na firmu a zjistí se to až ve chvíli, kdy
 * je objednávka zaplacená.
 */
export const zkontrolujFirmu = (vstup: {
  nazev?: string | null
  ico?: string | null
  dic?: string | null
}): string | null => {
  if (!vstup.nazev?.trim()) {
    return "Vyplňte prosím název firmy."
  }

  if (!vstup.ico?.trim()) {
    return "Vyplňte prosím IČO."
  }

  if (!platneIco(vstup.ico)) {
    return "IČO nesedí — má osm číslic a poslední z nich je kontrolní. Zkontrolujte prosím překlep."
  }

  if (!platneDic(vstup.dic ?? "")) {
    return "DIČ má tvar CZ a osm až deset číslic, například CZ12345678."
  }

  return null
}
