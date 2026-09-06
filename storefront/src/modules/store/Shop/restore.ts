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
 * Zapisuje se JEN při odchodu na výrobek (viz posluchač v index.tsx) a při
 * návratu se hned spotřebuje. Vstup do obchodu z menu tedy žádný snímek
 * nenajde a otevře se čistý, jak má.
 */
export type ShopSnapshot = {
  filters: ShopFilters
  /** Kolik kusů bylo načteno — tedy i kolikrát se stránkovalo. */
  loaded: number
  scrollY: number
}

const KEY = "shop:snapshot"

/**
 * Přečte snímek, ale NEZAHODÍ ho — o to se stará `clearShopSnapshot` po
 * dokončení obnovy.
 *
 * Čtení a zahození byly nejdřív jeden krok, jenže React ve vývoji efekt
 * schválně spouští dvakrát: první běh snímek snědl, druhý už našel prázdno
 * a výsledek toho prvního patřil odpojené kopii komponenty, takže se zahodil.
 * Výpis se pak vrátil na prvních šestnáct kusů — naměřeno 16 místo 27.
 * Rozdělené je čtení bez následků a dvojí běh nanejvýš pošle dotaz dvakrát.
 */
export const peekShopSnapshot = (): ShopSnapshot | null => {
  if (typeof window === "undefined") return null

  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<ShopSnapshot>
    if (!parsed || typeof parsed !== "object" || !parsed.filters) return null

    return {
      filters: parsed.filters as ShopFilters,
      loaded: Number(parsed.loaded) || 0,
      scrollY: Number(parsed.scrollY) || 0,
    }
  } catch {
    /* Soukromé okno, plná kvóta, cizí data pod klíčem — obchod se prostě
       otevře od začátku. Za to nemá nic spadnout. */
    return null
  }
}

/** Snímek platí pro jeden návrat — po obnově (i po jejím selhání) zmizí. */
export const clearShopSnapshot = () => {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    /* Viz níž. */
  }
}

export const saveShopSnapshot = (snapshot: ShopSnapshot) => {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    /* Viz výš — bez paměti se jen ztratí pohodlí, ne funkce. */
  }
}
