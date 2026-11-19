import type { ShopFilters } from "./types"

/**
 * Kam se člověk v obchodě dostal — aby se tam po návratu z výrobku vrátil.
 *
 * Katalog drží VŠECHNO v paměti komponenty: filtry, načtené kusy i to,
 * kolikrát se kliklo na „Načíst další". Odchod na kartu výrobku je změna
 * routy, komponenta se odpojí a s ní zmizí i ta paměť — po návratu se
 * obchod poskládal znovu od začátku: prvních šestnáct kusů, žádný filtr,
 * scroll nahoře. Kdo prošel čtyři stránky výpisu a otevřel šestapadesátý
 * kus, začínal po návratu znovu.
 *
 * Proto snímek v `sessionStorage`: přežije přechod mezi stránkami, ale ne
 * zavření panelu prohlížeče — zítra má obchod začínat čistý.
 *
 * Zapisuje se JEN při odchodu na výrobek (viz posluchač v index.tsx).
 *
 * Spotřebovat se ale smí jen při NÁVRATU, tedy po stisku Zpět — tady bývalo
 * napsáno, že příchod z menu žádný snímek nenajde, a nebyla to pravda:
 * snímek leží v paměti až do příští návštěvy obchodu, ať se tam člověk
 * dostane jakkoli. Kdo si prohlédl výrobek a pak klepl na „E-shop“, spadl
 * doprostřed výpisu. O to, jestli jde o návrat, se ptá `prisliJsmeZpet()`
 * (`lib/helpers/navigace-zpet.ts`); při jiném příchodu se snímek zahodí.
 */
export type ShopSnapshot = {
  filters: ShopFilters
  /** Kolik kusů bylo načteno — tedy i kolikrát se stránkovalo. */
  loaded: number
  scrollY: number
}

const KEY = "shop:snapshots"
/** Kolik posledních adres obchodu si pamatovat (kvóta sessionStorage). */
const MAX_ADRES = 20

/*
 * Snímek PATŘÍ ADRESE (19. 11. 2026). Dřív byl jeden na celý obchod: kdo
 * z výpisu na 3000 px vybral kategorii v nabídce E-shop a dal Zpět, dostal
 * obnovený snímek té kategorie (posunu v ní se ukládal pořád) — v adrese
 * zůstala kategorie a stránka skončila dole. Změřeno na iPhonu. Klíč je cesta
 * i s dotazem, tedy přesně záznam historie, na který se Zpět vrací (filtry
 * do něj zapisuje `replaceState`, takže sedí i po přefiltrování v panelu).
 */
const adresa = () => window.location.pathname + window.location.search

type Ulozene = Record<string, ShopSnapshot & { at: number }>

const nacti = (): Ulozene => {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Ulozene) : {}
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const zapis = (vse: Ulozene) => {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(vse))
  } catch {
    /* Soukromé okno nebo plná kvóta — bez paměti se jen ztratí pohodlí. */
  }
}

/**
 * Přečte snímek TÉHLE adresy, ale NEZAHODÍ ho — o to se stará
 * `clearShopSnapshot` po dokončení obnovy.
 *
 * Čtení a zahození byly nejdřív jeden krok, jenže React ve vývoji efekt
 * schválně spouští dvakrát: první běh snímek snědl, druhý už našel prázdno
 * a výsledek toho prvního patřil odpojené kopii komponenty, takže se zahodil.
 * Rozdělené je čtení bez následků a dvojí běh nanejvýš pošle dotaz dvakrát.
 */
export const peekShopSnapshot = (): ShopSnapshot | null => {
  if (typeof window === "undefined") return null
  const zaznam = nacti()[adresa()]
  if (!zaznam || typeof zaznam !== "object" || !zaznam.filters) return null
  return {
    filters: zaznam.filters as ShopFilters,
    loaded: Number(zaznam.loaded) || 0,
    scrollY: Number(zaznam.scrollY) || 0,
  }
}

/** Snímek téhle adresy platí pro jeden návrat — po obnově (i po jejím selhání) zmizí. */
export const clearShopSnapshot = () => {
  if (typeof window === "undefined") return
  const vse = nacti()
  if (!(adresa() in vse)) return
  delete vse[adresa()]
  zapis(vse)
}

export const saveShopSnapshot = (snapshot: ShopSnapshot) => {
  if (typeof window === "undefined") return
  const vse = nacti()
  vse[adresa()] = { ...snapshot, at: Date.now() }
  const klice = Object.keys(vse)
  if (klice.length > MAX_ADRES) {
    klice
      .sort((a, b) => (vse[a].at ?? 0) - (vse[b].at ?? 0))
      .slice(0, klice.length - MAX_ADRES)
      .forEach((klic) => delete vse[klic])
  }
  zapis(vse)
}
