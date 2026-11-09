import { useCallback } from "react"
import { useSearchParams } from "react-router-dom"

/**
 * Kus stavu stránky, který přežije odchod a návrat.
 *
 * ## Proč
 *
 * Majitelka si v „Kolekce a kategorie" proklikala kolekci a kategorii, otevřela
 * produkt na úpravu — a po návratu stála zase na začátku a musela obojí vybrat
 * znovu. U katalogu o dvou stech kusech to není drobnost, to je práce navíc
 * u každého jednoho produktu (hlášeno 8. 11. 2026).
 *
 * Příčina je obyčejná: výběr žil v `useState`, tedy v paměti komponenty, a ta
 * se odchodem ze stránky zahodí. Když místo toho stojí v adrese, vrátí ho
 * tlačítko Zpět samo — a adresa se dá poslat i uložit do oblíbených.
 *
 * ## Proč se změny sbírají do dávky
 *
 * Tohle je oprava z 9. 11. 2026 a stojí za to ji vysvětlit, protože se kvůli
 * ní nedalo otevřít vůbec nic.
 *
 * Jedno ťuknutí obvykle mění víc klíčů najednou — klik na kolekci vybere
 * kolekci, zahodí kategorii a vypne „všechny kategorie". To jsou tři volání
 * setteru hned za sebou.
 *
 * Jenže `setSearchParams` z react-routeru počítá novou adresu vždycky
 * z `location.search` posledního VYKRESLENÍ (viz jeho `useCallback`
 * se závislostí na `searchParams`). V jednom obslužném kódu se mezitím
 * nic nevykreslí, takže druhé a třetí volání vycházelo z původní, prázdné
 * adresy — a přepsalo to, co zapsalo první. Poslední zápis vyhrál a byl
 * prázdný: klik na kolekci vybral kolekci a hned ji zase zahodil. Zvenčí
 * to vypadalo, že tlačítko nic nedělá.
 *
 * Proto se změny z jednoho ťuknutí nejdřív posbírají a do adresy se zapíšou
 * jednou, v mikroúloze hned po doběhnutí obsluhy — tedy ještě před
 * vykreslením. Jeden klik = jeden zápis = jeden krok v historii.
 *
 * ## Proč `replace`, a ne nový krok v historii
 *
 * Každé ťuknutí na filtr by jinak bylo samostatným krokem a Zpět by se vracelo
 * přes ně místo na stránku, ze které člověk přišel. Nahrazení drží historii
 * tak, jak ji čekáte: jedna stránka = jeden krok.
 *
 * ## Výchozí hodnota se do adresy nepíše
 *
 * Aby adresa zůstala krátká a čitelná. „Nic nevybráno" a „vybráno výchozí" je
 * z pohledu stránky totéž.
 */

/** Co se má v adrese změnit: hodnota, nebo `null` = klíč pryč. */
export type Zmeny = Record<string, string | null>

/**
 * Jak bude dotaz adresy vypadat po těchhle změnách.
 *
 * Prázdný řetězec se chová jako `null` — „nic nevybráno" nemá v adrese
 * zabírat místo.
 */
export const sloucZmeny = (
  soucasne: URLSearchParams,
  zmeny: Zmeny
): URLSearchParams => {
  const dalsi = new URLSearchParams(soucasne)
  for (const [klic, hodnota] of Object.entries(zmeny)) {
    if (hodnota === null || hodnota === "") {
      dalsi.delete(klic)
    } else {
      dalsi.set(klic, hodnota)
    }
  }
  return dalsi
}

/**
 * Sběrač změn jednoho ťuknutí.
 *
 * První volání si naplánuje zápis a další volání do stejné dávky jen
 * přisypou. Zapisuje se tedy jednou, se vším dohromady.
 *
 * Plánovač je parametr schválně: v prohlížeči je to mikroúloha, v testu
 * obyčejná fronta, kterou si test spustí sám.
 */
export const vytvorSberac = (
  naplanuj: (uloha: () => void) => void
): ((zmeny: Zmeny, zapis: (vse: Zmeny) => void) => void) => {
  let davka: Zmeny | null = null

  return (zmeny, zapis) => {
    if (davka) {
      Object.assign(davka, zmeny)
      return
    }
    davka = { ...zmeny }
    naplanuj(() => {
      const vse = davka ?? {}
      davka = null
      zapis(vse)
    })
  }
}

/* Jedna dávka pro celou administraci — v jednom okně běží jedna stránka. */
const sberac = vytvorSberac((uloha) => queueMicrotask(uloha))

/**
 * Zapsat do adresy několik klíčů najednou.
 *
 * Tohle je ta spolehlivá cesta: ať voláte jeden setter nebo pět, z jednoho
 * ťuknutí vznikne jeden zápis. Stránky ji můžou volat i přímo, když chtějí
 * změnit víc věcí zároveň a je to tak čitelnější.
 */
export const useUrlPatch = (): ((zmeny: Zmeny) => void) => {
  const [, setParams] = useSearchParams()

  return useCallback(
    (zmeny: Zmeny) => {
      sberac(zmeny, (vse) => {
        setParams((soucasne) => sloucZmeny(soucasne, vse), { replace: true })
      })
    },
    [setParams]
  )
}

export function useUrlState<T extends string>(
  klic: string,
  vychozi: T
): [T, (hodnota: T) => void]
export function useUrlState<T extends string>(
  klic: string
): [T | null, (hodnota: T | null) => void]
export function useUrlState<T extends string>(
  klic: string,
  vychozi?: T
): [T | null, (hodnota: T | null) => void] {
  const [params] = useSearchParams()
  const zapis = useUrlPatch()
  const hodnota = (params.get(klic) as T | null) ?? vychozi ?? null

  const nastav = useCallback(
    (nova: T | null) => {
      zapis({ [klic]: nova === vychozi ? null : nova })
    },
    [klic, vychozi, zapis]
  )

  return [hodnota, nastav]
}

/** Totéž pro zaškrtnutí: v adrese `?klic=1`, jinak nic. */
export const useUrlFlag = (klic: string): [boolean, (zapnuto: boolean) => void] => {
  const [hodnota, nastav] = useUrlState(klic)
  return [
    hodnota === "1",
    useCallback((zapnuto: boolean) => nastav(zapnuto ? "1" : null), [nastav]),
  ]
}
