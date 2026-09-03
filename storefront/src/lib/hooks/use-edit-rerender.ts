"use client"

import { isEditMode } from "@c3studium/valecms/edit"
import { useEffect, useRef, useState } from "react"

/**
 * Jedno překreslení navíc, jakmile se zapne režim editace.
 *
 * ## Co řeší
 *
 * `editable()` se ptá `isEditMode()` **při renderu** a mimo režim editace vrací `{}`. Režim se
 * ale zapíná až z efektu — schválně, aby se `data-cms-*` nikdy nedostalo do veřejného HTML a
 * aby první klientský render seděl na serverový (jinak by React hlásil neshodu hydratace).
 *
 * Knihovna proto po zapnutí překreslí kořen. V App Routeru se to ale k části stromu nedostane:
 * potomci, kteří přišli ze serverové komponenty, jsou hotové elementy, React je porovná jako
 * totožné a překreslení u nich skončí. Komponent, který se od té chvíle nepřekreslí sám, si
 * tedy navždy ponechá prázdné atributy — a v editoru se tváří, že jde o text natvrdo v kódu.
 *
 * Většina sekcí to nepocítí: překreslí je `useInView` nebo hodnoty ze scrollu. Zasažené jsou
 * právě ty klidné — `Carousel` má jediný stav, šipky, takže bez kliknutí se nepřekreslí nikdy.
 * Změřeno: z anotovaných bloků úvodní stránky se v rámu editoru objevily jen ty, které se
 * překreslují z jiného důvodu.
 *
 * ## Proč `requestAnimationFrame`
 *
 * Efekty potomků běží PŘED efekty rodičů, takže obyčejný `useEffect` by se ptal dřív, než
 * knihovna režim zapne. Snímek nato je odpověď hotová.
 *
 * ## Co to stojí návštěvníka
 *
 * Nic. Mimo editor je `isEditMode()` vždycky `false`, takže se nic nepřekresluje; `armed` drží
 * hodnotu z prvního renderu, aby se nepřekreslovalo ani při přechodu uvnitř editoru, kde už
 * atributy vznikly napoprvé.
 */
export function useEditRerender(): void {
  const [, bump] = useState(0)
  const armed = useRef(isEditMode())

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (armed.current || !isEditMode()) return
      armed.current = true
      bump((n) => n + 1)
    })
    return () => cancelAnimationFrame(id)
  }, [])
}

export default useEditRerender
