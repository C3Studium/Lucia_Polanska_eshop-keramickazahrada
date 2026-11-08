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
  const [params, setParams] = useSearchParams()
  const hodnota = (params.get(klic) as T | null) ?? vychozi ?? null

  const nastav = useCallback(
    (nova: T | null) => {
      setParams(
        (soucasne) => {
          const dalsi = new URLSearchParams(soucasne)
          if (nova === null || nova === "" || nova === vychozi) {
            dalsi.delete(klic)
          } else {
            dalsi.set(klic, nova)
          }
          return dalsi
        },
        { replace: true }
      )
    },
    [klic, setParams, vychozi]
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
