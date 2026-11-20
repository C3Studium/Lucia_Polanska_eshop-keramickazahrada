/**
 * Hledání výrobků podle relevance, s tolerancí překlepů (20. 11. 2026).
 *
 * Dřív obchod hledal přes Medusu (`q` = prostá shoda podřetězce) a lišta
 * filtrovala „obsahuje" nad názvem, kolekcí a kategoriemi bez pořadí —
 * „Květináč" ukázal jako první pítko (Matěj z telefonu). Teď:
 *
 * - bez diakritiky a velikosti písmen („kvetinac" = „Květináč");
 * - slovo po slově; česká koncovka nevadí — shoda začátku slova
 *   („květináč" ~ „květináče", „květináčů");
 * - překlep: 1 chyba od 4 znaků, 2 od 7 (i prohozená dvě písmena);
 * - váha podle místa: název ≫ kategorie/druh > popis; název, který dotazem
 *   začíná nebo ho celý obsahuje, jde nahoru;
 * - víc slov v dotazu: všechna musí něco najít (u 3+ slov stačí všechna
 *   kromě jednoho), jinak výrobek do výsledků nepatří.
 *
 * Čistá funkce bez Reactu a Medusy — používá ji obchod (`listStoreCatalogue`
 * přes `filterCatalogue`) i hledání v liště (`navbarSearch`).
 */

export type SearchFields = {
  title?: string | null
  /** Kategorie, kolekce, druh — „kde v obchodě to je". */
  taxonomy?: (string | null | undefined)[]
  description?: string | null
}

export const normalizeSearch = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()

const tokens = (value: string): string[] =>
  normalizeSearch(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0)

/** Damerau–Levenshtein (s prohozením sousedních písmen), s ranou zarážkou. */
const vzdalenost = (a: string, b: string, strop: number): number => {
  if (Math.abs(a.length - b.length) > strop) return strop + 1
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = new Array<number>(b.length + 1).fill(0)
    row[0] = i
    return row
  })
  for (let j = 0; j <= b.length; j += 1) d[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    let minRadku = Infinity
    for (let j = 1; j <= b.length; j += 1) {
      const cena = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cena)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
      minRadku = Math.min(minRadku, d[i][j])
    }
    if (minRadku > strop) return strop + 1
  }
  return d[a.length][b.length]
}

const spolecnyZacatek = (a: string, b: string): number => {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1
  return i
}

/** Jak dobře slovo dotazu sedí na slovo textu: 0 = vůbec, 10 = přesně. */
export const wordScore = (q: string, w: string): number => {
  if (!q || !w) return 0
  if (q === w) return 10
  if (q.length >= 2 && w.startsWith(q)) return 8
  // Česká koncovka: „kvetinac" ~ „kvetinace" / „kvetinacu" / „kvetinaci".
  // Dotaz se smí lišit jen posledním znakem a slovo textu nejvýš třemi —
  // jinak by „kvetinac" našel „kvetiny" a „kvetinace" krátké „kvet".
  const zacatek = spolecnyZacatek(q, w)
  if (q.length >= 4 && zacatek >= q.length - 1 && w.length - zacatek <= 3) return 7
  // Překlep — proti stejně dlouhému začátku slova (koncovka ať nevadí).
  // Dvě chyby až od 9 znaků; u kratších by „květináč" ~ „květiny".
  if (q.length >= 4) {
    const strop = q.length >= 9 ? 2 : 1
    const usek = w.slice(0, q.length)
    const kandidat = Math.min(
      vzdalenost(q, w, strop),
      vzdalenost(q, usek, strop),
      vzdalenost(q, w.slice(0, q.length + 1), strop)
    )
    if (kandidat <= strop) return kandidat === 1 ? 5 : 3
  }
  return 0
}

const VAHA = { title: 3, taxonomy: 1.5, description: 0.4 } as const

/**
 * Skóre výrobku pro dotaz; 0 = do výsledků nepatří. Vyšší = výš v seznamu.
 */
export const searchScore = (query: string, fields: SearchFields): number => {
  const dotaz = tokens(query)
  if (!dotaz.length) return 0
  const nazev = normalizeSearch(fields.title ?? "")
  const pole: [string[], number][] = [
    [tokens(fields.title ?? ""), VAHA.title],
    [tokens((fields.taxonomy ?? []).filter(Boolean).join(" ")), VAHA.taxonomy],
    [tokens(fields.description ?? "").slice(0, 120), VAHA.description],
  ]
  let soucet = 0
  let nalezeno = 0
  for (const q of dotaz) {
    let nejlepsi = 0
    for (const [slova, vaha] of pole) {
      for (const w of slova) {
        const s = wordScore(q, w)
        /* Popis jen přesně / začátkem slova — překlep v dlouhém popisu
           našel cokoli („sněhulák" → výrobky „na kameni"). */
        if (vaha === VAHA.description && s < 7) continue
        if (s) nejlepsi = Math.max(nejlepsi, s * vaha)
      }
    }
    if (nejlepsi > 0) nalezeno += 1
    soucet += nejlepsi
  }
  const potreba = dotaz.length >= 3 ? dotaz.length - 1 : dotaz.length
  if (nalezeno < potreba) return 0
  const celyDotaz = normalizeSearch(query)
  if (nazev.startsWith(celyDotaz)) soucet += 15
  else if (nazev.includes(celyDotaz)) soucet += 8
  return soucet
}

/** Seřadí výrobky podle relevance (stabilně), nesouvisející vynechá. */
export const rankBySearch = <T>(
  items: T[],
  query: string,
  fieldsOf: (item: T) => SearchFields
): T[] => {
  if (!normalizeSearch(query)) return items
  const ohodnocene = items
    .map((item, index) => ({ item, index, score: searchScore(query, fieldsOf(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
  /* Slabý konec pryč: co má pod 35 % nejlepší shody, hledání nepomáhá. */
  const prah = (ohodnocene[0]?.score ?? 0) * 0.35
  return ohodnocene.filter((entry) => entry.score >= prah).map((entry) => entry.item)
}
