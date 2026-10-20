"use client"

import { isEditMode } from "@c3studium/valecms/edit"
import { Fragment, useEffect, useState, type ReactNode } from "react"

/**
 * Obsah stránky jednou přemountovaný, když ji drží rám „Upravit kontent".
 *
 * ## Co řeší (změřeno 15. 10. 2026)
 *
 * Stránky s `loading.tsx` (obchod, košík, účet, výrobek, pokladna, výsledky
 * plateb…) mají kolem obsahu hranici Suspense, a ta se hydratuje AŽ PO
 * kořenovém layoutu. Režim editace přitom zapíná `StudioClient` v kořenovém
 * layoutu, takže když se obsah stránky konečně hydratuje, `editable()` už
 * vrací atributy — jenže server je nevykreslil. React 19 na to řekne „A tree
 * hydrated but some attributes … didn't match … This won't be patched up"
 * a atributy do DOM nedá. `useEditRerender` pak nepomůže: příznak byl zapnutý
 * už při prvním renderu, takže nemá co dohánět, a i kdyby překreslil, React
 * porovná nové props s těmi z hydratace (shodné) a DOM nechá být.
 *
 * Výsledek byl, že na těchhle stránkách nešel ve Studiu kliknout jediný text
 * obsahu — jen menu a patička, které se hydratují dřív.
 *
 * Přemountování je jediná cesta, jak atributy do DOM dostat: nový mount není
 * hydratace, takže se vykreslí tak, jak `editable()` odpoví. Stejný postup
 * používá knihovna sama (`withStudio.jsx`, viz komentář v `edit/arm.js`).
 *
 * ## Co to stojí návštěvníka
 *
 * Nic. Mimo rám Studia je `isEditMode()` vždycky `false`, klíč zůstane `0`
 * a strom je tentýž jako bez obalu. V rámu se obsah stránky jednou po načtení
 * vykreslí znovu (stav komponent se vynuluje) — tam to nevadí, editor ještě
 * nic neudělal.
 */
export default function EditModeRemount({ children }: { children: ReactNode }) {
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    // Snímek po commitu: zapnutí režimu je efekt v kořenovém layoutu a efekty
    // rodičů běží až po efektech potomků — viz `useEditRerender`.
    const id = requestAnimationFrame(() => {
      if (isEditMode()) setGeneration(1)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  return <Fragment key={generation}>{children}</Fragment>
}
