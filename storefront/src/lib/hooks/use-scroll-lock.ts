"use client"

import { useEffect } from "react"

/**
 * Zámek stránky pod otevřeným oknem (20. 11. 2026, Matěj: „ulož aktuální
 * polohu a zůstaň tam — na telefonu zakaž posun, na počítači zastav Lenis,
 * dokud se okno nezavře; náhodně to skáče").
 *
 * Dřív si to každé okno dělalo samo přes `body.style.overflow = "hidden"`:
 * - na počítači to Lenis nezastavilo — kolečko dál posouvalo stránku za
 *   oknem a po zavření skočila jinam;
 * - starší iOS (do 16) `overflow: hidden` na body ignoruje úplně.
 *
 * Tady jedno pravidlo pro všechna okna:
 * - Lenis (myš) → `lenis.stop()`; okno, které se má samo posouvat, nese
 *   `data-lenis-prevent` a Lenis do něj nesahá;
 * - bez Lenisu (dotyk) → body `position: fixed` posunuté o aktuální polohu,
 *   jediný spolehlivý zámek i na starém Safari;
 * - po zavření se vrátí přesně stejná poloha, bez přejezdu.
 *
 * Počítá vnoření: okno v okně (kontakt z rezervace) zámek nesundá, dokud se
 * nezavře i to vnější.
 */
let zamku = 0
let ulozenaY = 0
let predtim: Partial<CSSStyleDeclaration> = {}

const zamknout = () => {
  zamku += 1
  if (zamku > 1) return
  const body = document.body
  ulozenaY = window.scrollY
  if (window.lenis) {
    window.lenis.stop()
    document.documentElement.style.overflow = "hidden"
    return
  }
  predtim = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
  }
  body.style.position = "fixed"
  body.style.top = `-${ulozenaY}px`
  body.style.left = "0"
  body.style.right = "0"
  body.style.width = "100%"
}

const odemknout = () => {
  zamku = Math.max(0, zamku - 1)
  if (zamku > 0) return
  if (window.lenis) {
    document.documentElement.style.overflow = ""
    window.lenis.start()
    window.lenis.scrollTo(ulozenaY, { immediate: true, force: true })
    return
  }
  Object.assign(document.body.style, predtim)
  window.scrollTo(0, ulozenaY)
}

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    zamknout()
    return odemknout
  }, [active])
}
