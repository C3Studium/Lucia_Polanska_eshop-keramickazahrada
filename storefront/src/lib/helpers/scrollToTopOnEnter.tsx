"use client"

import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import { useEffect } from "react"

/**
 * Stránka vždy začne nahoře — i po tlačítku vpřed a zpět.
 *
 * `ScrollToTopOnEnter` je ostřejší sourozenec `ScrollToTopOnReload`: ten
 * odroluje jen po obnovení stránky, tenhle při každém příchodu. Rozdíl je
 * v tom, na co se nasazuje — karta výrobku není místo, kam se člověk vrací
 * pokračovat ve čtení. Přišel na jiný výrobek a chce ho vidět celý, ne
 * doprostřed popisu, kde skončil u předchozího.
 *
 * Prohlížeč i router si u záznamu v historii pamatují, kde jste na něm stáli,
 * a při kroku vpřed/zpět tam scroll vracejí. Tohle proti tomu jde dvakrát:
 * jednou hned v layoutovém efektu a podruhé v následujícím snímku, protože
 * obnova scrollu může přijít až po připojení komponenty a jediné odrolování by
 * přebila. Dvakrát nula za sebou nic nestojí a nikdo si toho nevšimne.
 *
 * `scrollWithLenis(0, { immediate: true })` místo `window.scrollTo`: stránky
 * jedou plynulý scroll a Lenis si drží vlastní pozici — kdyby se posunulo jen
 * okno, Lenis by ji při nejbližším pohybu vrátil zpátky.
 *
 * Kotva v adrese má přednost: odkaz na `#recenze` má skočit na recenze.
 */
export default function ScrollToTopOnEnter() {
  useEffect(() => {
    if (window.location.hash) return

    scrollWithLenis(0, { immediate: true })

    const frame = window.requestAnimationFrame(() => {
      scrollWithLenis(0, { immediate: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  return null
}
