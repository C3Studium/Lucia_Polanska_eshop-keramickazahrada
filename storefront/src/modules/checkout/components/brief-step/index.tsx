"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { isMadeToOrderLine } from "@lib/util/commission"
import {
  commissionPieceFilled,
  commissionPiecesOf,
} from "@lib/util/made-to-order"
import CheckoutCommissionBriefs from "@modules/checkout/components/commission-briefs"

import s from "./style.module.scss"
import { useTexty } from "@lib/context/texty"

/**
 * Zadání zakázky jako vlastní krok pokladny.
 *
 * ## Proč vlastní krok
 *
 * Zadání (co si zákazník představuje, plus fotky) bydlelo v pravém sloupci
 * vedle souhrnu. Byl to nejvyšší kus stránky, takže sloupec přerostl okno,
 * pole pro text padalo pod jeho spodní hranu a na telefonu se zadání muselo
 * duplikovat do kroku Přehled. Když jsme 8. 11. 2026 předělali pokladnu na
 * kroky, tohle byl ten pravý domov: jedna věc na obrazovce, bez souseda,
 * přes kterého se musí rolovat.
 *
 * ## Proč PŘED platbou
 *
 * Bez zadání pokladna k platbě nepustí — je to jediný údaj, který po zákazníkovi
 * chceme a který za něj nikdo nedoplní. Kdyby krok stál za platbou, člověk by
 * zaplatil a teprve pak se dozvěděl, že má ještě psát.
 */
export default function CheckoutBriefStep({ cart }: { cart: any }) {
  /* Věty z administrace (Právní věci a texty → Texty obchodu). */
  const texty = useTexty()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isOpen = (searchParams.get("step") ?? "address") === "brief"
  if (!isOpen) return null

  /*
   * Hotovo se čte ze SERVEROVÉHO košíku, ne ze stavu okna: zadání se ukládá
   * průběžně a po uložení se košík revaliduje. Tentýž zdroj pravdy jako
   * v kroku Přehled, aby si dvě místa neodporovala.
   */
  /* Po KUSECH, ne po řádku: „Domovní znamení · 2 ks" jsou dva kusy a každý
     má své zadání. Složený pohled na řádku je neprázdný už s jedním
     vyplněným, takže by krok pustil dál objednávku, u které druhý kus
     nikdo nepopsal. Totéž pravidlo jako v kroku Přehled. */
  const hotovo = ((cart?.items ?? []) as any[])
    .filter(isMadeToOrderLine)
    .every((item) => commissionPiecesOf(item).every(commissionPieceFilled))

  return (
    <div className={s.root}>
      <header className={s.head}>
        <h2>Zadání zakázky</h2>
        <p>
          {texty["zakazka.brief_uvod"]}</p>
      </header>

      <CheckoutCommissionBriefs cart={cart} />

      <div className={s.actions}>
        <button
          type="button"
          className={s.back}
          onClick={() =>
            router.push(pathname + "?step=delivery", { scroll: false })
          }
        >
          ← Zpět na doručení
        </button>
        <button
          type="button"
          className={s.next}
          disabled={!hotovo}
          onClick={() =>
            router.push(pathname + "?step=payment", { scroll: false })
          }
        >
          Pokračovat na platbu →
        </button>
      </div>

      {/* Důvod, proč tlačítko nejde zmáčknout — vedle něj, ne až po kliknutí. */}
      {!hotovo ? (
        <p className={s.hint} aria-live="polite">
          Vyplňte prosím zadání u každého kusu. Stačí pár vět, nebo fotka.
        </p>
      ) : null}
    </div>
  )
}
