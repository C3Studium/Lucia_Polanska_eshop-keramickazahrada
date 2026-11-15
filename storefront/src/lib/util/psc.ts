/**
 * PSČ → město (14. 11. 2026, „PSČ doplní město").
 *
 * Data: Česká pošta, Zákaznické výstupy → „Seznam PSČ částí obcí a obcí bez
 * částí" (db_pcobc, CSV, aktualizace měsíčně). Převádí je
 * `scripts/psc-build.mjs` do `lib/data/psc-obce.json` ({ "39701": ["Písek", …] }).
 */

export const normalizujPsc = (hodnota: string | null | undefined): string | null => {
  const cisla = String(hodnota ?? "").replace(/\s+/g, "")
  return /^\d{5}$/.test(cisla) ? cisla : null
}

/**
 * CSV České pošty → { psč: [obce] }. Hlavičku hledá podle názvu sloupců
 * (PSC a NAZOBCE), ne podle pořadí — formát se občas posune.
 */
export const obceZRadku = (csv: string): Record<string, string[]> => {
  const radky = csv.split(/\r?\n/).filter((r) => r.trim())
  if (!radky.length) return {}
  const oddelovac = radky[0].includes(";") ? ";" : ","
  const hlavicka = radky[0].split(oddelovac).map((h) => h.trim().replace(/^"|"$/g, "").toUpperCase())
  const iPsc = hlavicka.findIndex((h) => h === "PSC")
  const iObec = hlavicka.findIndex((h) => h === "NAZOBCE")
  if (iPsc < 0 || iObec < 0) throw new Error("V CSV chybí sloupec PSC nebo NAZOBCE.")

  const mapa = new Map<string, Set<string>>()
  for (const radek of radky.slice(1)) {
    const bunky = radek.split(oddelovac).map((b) => b.trim().replace(/^"|"$/g, ""))
    const psc = normalizujPsc(bunky[iPsc])
    const obec = bunky[iObec]
    if (!psc || !obec) continue
    if (!mapa.has(psc)) mapa.set(psc, new Set())
    mapa.get(psc)!.add(obec)
  }
  const vysledek: Record<string, string[]> = {}
  for (const psc of Array.from(mapa.keys()).sort()) {
    vysledek[psc] = Array.from(mapa.get(psc)!).sort((a, b) => a.localeCompare(b, "cs"))
  }
  return vysledek
}
