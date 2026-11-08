import { useMemo } from "react"
import { useLocation } from "react-router-dom"

/**
 * „Odkud jsem sem přišla a co je další v řadě."
 *
 * ## Proč
 *
 * Majitelka prochází kategorii kus po kuse: otevře produkt, upraví, zpět,
 * otevře další. Cesta přes výpis je u každého kusu dvojí kliknutí navíc
 * a u dvou set položek se to sečte. Chce „Další" rovnou na detailu
 * (8. 11. 2026).
 *
 * ## Proč sezení, a ne adresa
 *
 * Nabízelo by se poslat sousedy v odkazu (`?dalsi=…`). Jenže pak „Další"
 * funguje přesně jeden krok: další stránka už svého souseda nezná a tlačítko
 * zmizí. Celé pořadí do adresy nedáme — dvě stě identifikátorů je adresa na
 * několik kilobajtů.
 *
 * Výpis proto uloží své pořadí do sezení prohlížeče a detail si v něm najde
 * svoje místo. Drží to přes navigaci, zmizí se zavřením panelu, a nikde se
 * to neukazuje.
 *
 * ## Proč jeden klíč pro víc výpisů
 *
 * Do detailu produktu vedou dvě cesty — „Kolekce a kategorie" a „Produkty+".
 * Sdílejí klíč schválně: platí to pořadí, ze kterého člověk odešel naposled,
 * což je přesně to, co čeká.
 */

export type SeznamKontext = {
  /** Pořadí položek tak, jak je vidí výpis — včetně filtru a řazení. */
  ids: string[]
  /** Adresa výpisu i s filtry, aby se šlo vrátit přesně tam. */
  zpet: string
}

const klicPro = (seznam: string) => `kz-seznam:${seznam}`

/** Výpis ohlásí, co a v jakém pořadí ukazuje. Volá se při každé změně. */
export const ulozSeznam = (
  seznam: string,
  ids: string[],
  zpet: string
): void => {
  try {
    sessionStorage.setItem(klicPro(seznam), JSON.stringify({ ids, zpet }))
  } catch {
    /* Soukromé okno nebo zakázané úložiště — „Další" se prostě neukáže. */
  }
}

const prectiSeznam = (seznam: string): SeznamKontext | null => {
  try {
    const ulozene = sessionStorage.getItem(klicPro(seznam))
    if (!ulozene) return null
    const data = JSON.parse(ulozene) as SeznamKontext
    return Array.isArray(data?.ids) ? data : null
  } catch {
    return null
  }
}

export type Sousedi = {
  predchozi: string | null
  dalsi: string | null
  zpet: string | null
  /** Kolikátá z kolika — „3 / 27“ vedle šipek. */
  poradi: { index: number; celkem: number } | null
}

/**
 * Kde v posledním výpisu tahle položka stojí.
 *
 * Když ji tam nenajde (člověk přišel odjinud, z odkazu, z vyhledávání), vrátí
 * samá prázdna — tlačítka se pak nevykreslí. Mlčet je správně: nabídnout
 * „Další" podle cizího pořadí by bylo horší než ho nenabídnout.
 */
export const useSousedi = (seznam: string, aktualniId?: string): Sousedi => {
  const location = useLocation()

  return useMemo(() => {
    const prazdno: Sousedi = {
      predchozi: null,
      dalsi: null,
      zpet: null,
      poradi: null,
    }
    if (!aktualniId) return prazdno

    const kontext = prectiSeznam(seznam)
    if (!kontext) return prazdno

    const index = kontext.ids.indexOf(aktualniId)
    if (index === -1) {
      /* Zpět se nabídne i tak — do výpisu se vrátit chce vždycky. */
      return { ...prazdno, zpet: kontext.zpet || null }
    }

    return {
      predchozi: index > 0 ? kontext.ids[index - 1] : null,
      dalsi: index < kontext.ids.length - 1 ? kontext.ids[index + 1] : null,
      zpet: kontext.zpet || null,
      poradi: { index: index + 1, celkem: kontext.ids.length },
    }
    /* `location.key` v závislostech: po přechodu na dalšího souseda se musí
       spočítat znovu, i když se jméno seznamu nezměnilo. */
  }, [seznam, aktualniId, location.key])
}
