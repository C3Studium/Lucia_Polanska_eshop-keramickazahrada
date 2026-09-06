"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"

/*
 * Každá stránka začíná nahoře.
 *
 * Next si při přechodu odroluje nahoru sám, jenže tenhle obchod jede na
 * Lenisu — a ten si drží vlastní pozici. Když se posune jen okno, Lenis ji
 * při nejbližším pohybu kolečkem vrátí zpátky, takže nová stránka naskočí
 * uprostřed. Proto se roluje přes `scrollWithLenis`, ne přes `window.scrollTo`.
 *
 * Jedno místo pro celý web místo komponenty vloupané do každé stránky zvlášť:
 * dřív to řešily `ScrollToTopOnReload` (pět stránek) a `ScrollToTopOnEnter`
 * (karta výrobku), takže o zbylých stránkách nerozhodoval záměr, ale to,
 * jestli na ně někdo tu komponentu dopsal.
 */

/*
 * Katalog je jediná výjimka: drží si snímek scrollu, aby se návrat od výrobku
 * vrátil přesně tam, kde člověk přestal listovat (viz `Shop/restore.ts`).
 * Odrolování nahoru by ten snímek přebilo. Studio je aplikace ValeCMS, ne
 * stránka obchodu — tomu do scrollu nesaháme vůbec.
 */
const VYNECHAT = [/(?:^|\/)store(?:\/|$)/, /^\/studio(?:\/|$)/]

export default function ScrollResetOnRoute() {
  const pathname = usePathname()
  const predchozi = useRef<string | null>(null)

  useEffect(() => {
    const drive = predchozi.current
    predchozi.current = pathname

    // Změnil se jen dotaz v adrese (kroky pokladny, filtry) — to není nová
    // stránka a odrolovat by znamenalo vzít člověka od rozdělaného formuláře.
    if (drive === pathname) return

    // Kotva má přednost: odkaz na `#recenze` má skočit na recenze.
    if (window.location.hash) return

    if (VYNECHAT.some((cesta) => cesta.test(pathname))) return

    /*
     * Dvakrát: obnova scrollu z historie umí přijít až po připojení efektu
     * a jediné odrolování by přebila. Dvakrát nula za sebou nic nestojí.
     */
    scrollWithLenis(0, { immediate: true })
    const snimek = window.requestAnimationFrame(() => {
      scrollWithLenis(0, { immediate: true })
    })

    return () => window.cancelAnimationFrame(snimek)
  }, [pathname])

  return null
}
