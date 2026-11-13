"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import {
  jeObnoveniStranky,
  prisliJsmeZpet,
  sledujNavigaciZpet,
  zaznamenejNavigaciVAplikaci,
} from "@lib/helpers/navigace-zpet"

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
 * Studio je aplikace ValeCMS, ne stránka obchodu — tomu do scrollu nesaháme
 * vůbec.
 *
 * Katalog tu stával jako druhá výjimka, protože si drží snímek scrollu kvůli
 * návratu od výrobku. Jenže výjimka platila na KAŽDÝ příchod do obchodu, i
 * na ten z menu: kdo si prohlédl výrobek a pak klepl na „E-shop“, spadl
 * doprostřed výpisu (nahlášeno z telefonu 10. 11. 2026). Snímek je od toho,
 * aby fungovalo Zpět — a na Zpět se teď ptáme přímo, takže obchod může
 * odrolovat nahoru jako každá jiná stránka.
 */
const VYNECHAT = [/^\/studio(?:\/|$)/]

/*
 * Odrolování se po příchodu ještě dvakrát zopakuje.
 *
 * „Někdy když otevřu něco z e-shopu, tak se mi ukáže konec stránky a ne
 * začátek“ — hlášeno z notebooku. Příčina: stránka se po přechodu teprve
 * skládá (obrázky, dodatečně načtené bloky) a je v tu chvíli kratší než ta
 * předchozí. Prohlížeč proto scroll ořízne na její konec a když vzápětí
 * doroste, zůstane tam, kde ořez skončil.
 *
 * Opakuje se jen do chvíle, než člověk sám sáhne na kolečko, obrazovku nebo
 * klávesy — od té chvíle má přednost on. `scroll` jako signál nestačí: ten
 * vyvolá i tohle vlastní rolování.
 */
const OPAKOVANI_MS = [120, 360]

export default function ScrollResetOnRoute() {
  const pathname = usePathname()
  const predchozi = useRef<string | null>(null)

  useEffect(() => sledujNavigaciZpet(), [])

  useEffect(() => {
    const drive = predchozi.current
    predchozi.current = pathname

    // Změnil se jen dotaz v adrese (kroky pokladny, filtry) — to není nová
    // stránka a odrolovat by znamenalo vzít člověka od rozdělaného formuláře.
    if (drive === pathname) return

    if (drive !== null) zaznamenejNavigaciVAplikaci()

    /* Obnovená stránka zůstává, kde byla (13. 11. 2026) — obchod si polohu
       vrací sám (`Shop/index.tsx`), jinde ji vrací prohlížeč. Odrolování
       nahoru ji dřív při každém F5 zahodilo. */
    if (drive === null && jeObnoveniStranky()) return

    // Kotva má přednost: odkaz na `#recenze` má skočit na recenze.
    if (window.location.hash) return

    if (VYNECHAT.some((cesta) => cesta.test(pathname))) return

    /* Zpět vrací člověka tam, kde byl — ne na začátek stránky. */
    if (prisliJsmeZpet()) return

    /*
     * Dvakrát hned: obnova scrollu z historie umí přijít až po připojení
     * efektu a jediné odrolování by přebila. Dvakrát nula za sebou nic nestojí.
     */
    scrollWithLenis(0, { immediate: true })
    const snimek = window.requestAnimationFrame(() => {
      scrollWithLenis(0, { immediate: true })
    })

    let saheNaTo = false
    const prestat = () => {
      saheNaTo = true
    }
    const signaly = ["wheel", "touchstart", "keydown", "pointerdown"] as const
    for (const signal of signaly) {
      window.addEventListener(signal, prestat, { passive: true, once: true })
    }

    const casovace = OPAKOVANI_MS.map((za) =>
      window.setTimeout(() => {
        if (saheNaTo || window.scrollY === 0) return
        scrollWithLenis(0, { immediate: true })
      }, za)
    )

    return () => {
      window.cancelAnimationFrame(snimek)
      for (const casovac of casovace) window.clearTimeout(casovac)
      for (const signal of signaly) {
        window.removeEventListener(signal, prestat)
      }
    }
  }, [pathname])

  return null
}
