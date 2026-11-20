"use client"

import { useEffect } from "react"

import { prisliJsmeZpet } from "@lib/helpers/navigace-zpet"

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
 *
 * Odchod na jinou stránku z otevřeného okna (20. 11. 2026, Matěj: „otevřu
 * menu, ťuknu na košík a stránka sjede dolů"): menu se zavře až PO změně
 * adresy, takže by se stará poloha vrátila na NOVÉ stránce. Odrolování
 * nahoru (ScrollResetOnRoute) přitom proběhlo pod zámkem naprázdno. Když se
 * stránka mezitím změnila, zámek proto polohu nevrací a začne nahoře —
 * kromě návratu zpět, kde si polohu vrací stránka sama (obchod).
 */
let zamku = 0
let ulozenaY = 0
let predtim: Partial<CSSStyleDeclaration> = {}
let stranka = ""

const adresa = () => window.location.pathname + window.location.search

const zamknout = () => {
  zamku += 1
  if (zamku > 1) return
  const body = document.body
  ulozenaY = window.scrollY
  stranka = adresa()
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
  const jinaStranka = adresa() !== stranka
  /* Návrat zpět nebo odkaz s kotvou na jinou stránku: polohu řídí ta
     stránka (obchod, `#sekce`), nesahat. */
  const nechat = jinaStranka && (prisliJsmeZpet() || Boolean(window.location.hash))
  const cil = jinaStranka ? 0 : ulozenaY
  if (window.lenis) {
    document.documentElement.style.overflow = ""
    window.lenis.start()
    if (!nechat) window.lenis.scrollTo(cil, { immediate: true, force: true })
    return
  }
  Object.assign(document.body.style, predtim)
  if (!nechat) window.scrollTo(0, cil)
}

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    zamknout()
    return odemknout
  }, [active])
}

/**
 * Skutečná poloha stránky i pod zámkem. Zamčené body (`position: fixed`)
 * hlásí `scrollY` 0 — obchod si ji ukládá pro návrat Zpět a z menu
 * otevřeného hluboko v katalogu si dřív uložil nulu (20. 11. 2026).
 */
export const polohaStranky = (): number =>
  typeof window === "undefined" ? 0 : zamku > 0 ? ulozenaY : window.scrollY
