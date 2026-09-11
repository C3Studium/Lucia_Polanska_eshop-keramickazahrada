import { MutationCache, QueryClient } from "@tanstack/react-query"

/**
 * Jedna mezipaměť pro celou administraci — a automatická obnova po každém
 * úspěšném zápisu.
 *
 * ## Proč to muselo vzniknout
 *
 * Po založení slevy bylo potřeba Ctrl+R, jinak ji seznam neukázal. Za tím byly
 * dvě věci naráz:
 *
 * 1. **Každá stránka i widget si dělaly vlastní `new QueryClient()`** — bylo
 *    jich 45. Klíče dotazů se přitom sdílejí, takže když jedna stránka po
 *    uložení zneplatnila `["operations-discounts"]`, zneplatnila ho ve SVÉ
 *    mezipaměti, ne v té, ze které čte druhá stránka. A protože se klient
 *    vyráběl na úrovni modulu, přežil i odchod ze stránky a zpět.
 *
 * 2. **Zneplatnění se vypisovalo ručně, a seznamy klíčů se rozešly.**
 *    `discount-editor.tsx` zneplatňuje `["operations-discounts"]`, jenže
 *    stejný editor visí i ve Slevách — správě, jejíž seznam čte
 *    `["workbench-discounts"]`. Ten klíč se v editoru nikdy neobjevil, takže
 *    sleva vznikla a seznam o ní nevěděl. Tenhle typ chyby vzniká pokaždé,
 *    když se komponenta začne používat na novém místě — nikdo si nevzpomene
 *    dopsat klíč.
 *
 * ## Jak se to řeší
 *
 * Jeden klient na aplikaci (to je i to, s čím React Query počítá; 45 kusů byl
 * důsledek kopírování zapouzdření, ne úmysl) a nad ním jedno pravidlo:
 * **po každém úspěšném zápisu zneplatnit všechno**. Ruční `invalidateQueries`
 * v komponentách můžou zůstat — jsou rychlejší a přesnější; tohle je záchranná
 * síť pro klíče, na které se zapomnělo.
 *
 * Zneplatnění není načtení: znovu se stáhnou jen dotazy, které někdo právě
 * sleduje, tedy ty na otevřené stránce. Bývá jich pár.
 *
 * ## Proč se to slučuje se zpožděním
 *
 * Hromadné operace posílají zápisů několik za sebou (uložit ceny, přepnout
 * viditelnost, srovnat pořadí). Bez odkladu by se seznam načítal po každém
 * z nich. Krátká pauza je slije do jednoho načtení.
 *
 * ## Když se dotaz obnovovat nemá
 *
 * `meta: { bezObnovy: true }` u `useQuery` ho z automatické obnovy vyjme —
 * pro data, která zápisy nemění a jejich načtení něco stojí.
 */

/** Jak dlouho se čeká, jestli nepřijde další zápis. */
const SLOUCENI_MS = 250

let odklad: ReturnType<typeof setTimeout> | undefined

const obnovitPozdeji = () => {
  clearTimeout(odklad)
  odklad = setTimeout(() => {
    void adminQueryClient.invalidateQueries({
      predicate: (dotaz) => dotaz.meta?.bezObnovy !== true,
    })
  }, SLOUCENI_MS)
}

export const adminQueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: obnovitPozdeji,
  }),
})
