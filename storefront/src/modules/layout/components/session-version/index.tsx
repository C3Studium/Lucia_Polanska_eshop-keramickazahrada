"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

import {
  BUILD_STAMP,
  CART_PENDING_KEY,
  CART_VERSION_ENDPOINT,
  RELOAD_GUARD_KEY,
  clearAppStorage,
} from "@lib/util/session-version"

/*
 * Hlídka nad otevřenou záložkou.
 *
 * Skript vložený do stránky uklidí po předchozí verzi při načtení. Tohle je
 * ten druhý případ: záložka, která zůstala otevřená přes nasazení. Ta o nové
 * verzi nemá jak vědět — drží v paměti router i balík té staré a při přechodu
 * na další stránku si řekne o soubory, které na serveru už nejsou.
 *
 * Od 18. 11. 2026 se neptá pravidelně: poslouchá živé spojení `/api/live`
 * (viz efekt níž a `lib/server/live-bus`).
 */
const LIVE_ENDPOINT = "/api/live"

/*
 * Kde se znovunačíst nesmí. Rozepsaná data v pokladně, návrat od platební
 * brány, účet (adresy, heslo, úprava objednávky), košík a rozeditovaný text
 * ve studiu ValeCMS — obnovení by vzalo něco, co uživatel nemá jak získat
 * zpět. Nová verze na něj počká; dostane ji při nejbližším přechodu jinam.
 */
const CHRANENE_CESTY = [
  /\/checkout(\/|$|\?)/,
  /\/order\//,
  /\/account(\/|$)/,
  /\/cart(\/|$)/,
  /^\/studio/,
]

const bezpecneZnovunacist = () => {
  if (CHRANENE_CESTY.some((cesta) => cesta.test(window.location.pathname))) {
    return false
  }

  const aktivni = document.activeElement

  if (aktivni instanceof HTMLElement) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(aktivni.tagName)) return false
    if (aktivni.isContentEditable) return false
  }

  return true
}

const SessionVersionWatch = () => {
  const router = useRouter()
  const pathname = usePathname()
  const dohnatRef = useRef<(() => void) | null>(null)

  /*
   * Košík na novou verzi.
   *
   * Vložený skript uklidil, co bylo v prohlížeči, ale na košík nedosáhne —
   * ten drží httpOnly cookie a jeho rozdělaná pokladna (doprava, výdejní
   * místo, platební kolekce) stárne se serverem, ne se záložkou. Nechal
   * po sobě proto vzkaz a ten se tady jednou vyzvedne.
   *
   * Server sám pozná, jestli je co dělat: zdravý nákup jen orazítkuje,
   * překládá jen košík, jehož doprava už neplatí. `refresh()` je tu proto,
   * aby stránka přestala ukazovat košík, který mezitím dostal nové id.
   */
  useEffect(() => {
    let zruseno = false

    const prevestKosik = async () => {
      let cekaSe: string | null = null
      try {
        cekaSe = window.sessionStorage.getItem(CART_PENDING_KEY)
      } catch {
        return
      }

      if (!cekaSe || window.location.pathname.startsWith("/studio")) return

      // Nejdřív zahodit, až potom volat: opakovat převod po chybě nemá
      // smysl, a zacyklit se na něm už vůbec.
      try {
        window.sessionStorage.removeItem(CART_PENDING_KEY)
      } catch {}

      try {
        const odpoved = await fetch(CART_VERSION_ENDPOINT, {
          method: "POST",
          cache: "no-store",
        })
        if (!odpoved.ok || zruseno) return

        const { stav, krok } = await odpoved.json()
        if (zruseno || (stav !== "prenesen" && stav !== "zahozen")) return

        /*
         * V pokladně nestačí stránku překreslit: krok v adrese ukazuje na
         * dopravu nebo platbu, které jsme právě zrušili, a zákazník by skončil
         * zpátky na adrese, kterou má vyplněnou. Server ví, kam patří.
         * `replace`, aby po tom nezůstal krok v historii.
         */
        if (krok && window.location.pathname.includes("/checkout")) {
          router.replace(`${window.location.pathname}?step=${krok}`)
          return
        }

        router.refresh()
      } catch {
        // Košík zůstane, jaký byl. Není to důvod cokoli zákazníkovi hlásit.
      }
    }

    void prevestKosik()

    return () => {
      zruseno = true
    }
  }, [router])

  /*
   * Živé spojení s obchodem (18. 11. 2026, přání majitele: „změna hned,
   * backend zavolá obchod, jinak nic nekontrolovat"). Žádné dotazování —
   * záložka poslouchá `/api/live`:
   *
   * - `changed` = v administraci se něco uložilo a obchod už zahodil
   *   mezipaměť. Záložka si obsah obnoví na místě (`router.refresh` — bez
   *   znovunačtení, rozepsané věci i poloha zůstanou).
   * - `hello` přijde po každém (znovu)připojení s otiskem verze. Po nasazení
   *   se spojení přeruší, prohlížeč se připojí znovu a jiný otisk znamená
   *   novou verzi → jedno celé znovunačtení.
   *
   * Obojí jen v bezpečnou chvíli (`bezpecneZnovunacist`: ne v pokladně,
   * účtu, košíku, na objednávce ani při psaní). Jinak se to odloží na
   * nejbližší přechod jinam nebo na chvíli, kdy pole přestane mít fokus.
   */
  useEffect(() => {
    if (typeof EventSource === "undefined") return

    let zruseno = false
    let novaVerze: string | null = null
    let obnovit = false
    let zdroj: EventSource | null = null

    const nacistNovouVerzi = () => {
      if (!novaVerze || zruseno) return
      /*
       * Pojistka proti smyčce. Při postupném nasazení může chvíli vedle sebe
       * běžet stará i nová instance a odpovědi se střídají — bez tohohle by
       * se záložka načítala dokola.
       */
      try {
        if (window.localStorage.getItem(RELOAD_GUARD_KEY) === novaVerze) return
      } catch {
        return
      }
      if (!bezpecneZnovunacist()) return
      zruseno = true
      // Pořadí: úklid maže i klíče s předponou `kz:`, tedy i tuhle pojistku.
      clearAppStorage()
      try {
        window.localStorage.setItem(RELOAD_GUARD_KEY, novaVerze)
      } catch {
        // Bez úložiště se pojistka nezapíše; smyčku hlídá `zruseno`.
      }
      window.location.reload()
    }

    const obnovitObsah = () => {
      if (!obnovit || zruseno) return
      if (!bezpecneZnovunacist()) return
      obnovit = false
      router.refresh()
    }

    const dohnat = () => {
      nacistNovouVerzi()
      obnovitObsah()
    }

    const pripojit = () => {
      zdroj?.close()
      zdroj = new EventSource(LIVE_ENDPOINT)
      zdroj.addEventListener("hello", (event) => {
        let stamp: string | undefined
        try {
          stamp = JSON.parse((event as MessageEvent).data)?.stamp
        } catch {
          return
        }
        if (BUILD_STAMP && stamp && stamp !== BUILD_STAMP) {
          novaVerze = stamp
          nacistNovouVerzi()
        }
      })
      zdroj.addEventListener("changed", () => {
        obnovit = true
        obnovitObsah()
      })
    }

    pripojit()
    dohnatRef.current = dohnat

    /* Mobil na pozadí spojení zavře; po návratu se připojí znovu (a z `hello`
       se dozví, jestli mezitím nevyšla nová verze). */
    const priNavratu = () => {
      if (document.visibilityState !== "visible") return
      if (!zdroj || zdroj.readyState === EventSource.CLOSED) pripojit()
      dohnat()
    }
    /* Pole přestalo mít fokus — odložená obnova se může dohnat. */
    const poOpusteniPole = () => window.setTimeout(dohnat, 0)

    document.addEventListener("visibilitychange", priNavratu)
    document.addEventListener("focusout", poOpusteniPole)

    return () => {
      zruseno = true
      dohnatRef.current = null
      zdroj?.close()
      document.removeEventListener("visibilitychange", priNavratu)
      document.removeEventListener("focusout", poOpusteniPole)
    }
  }, [router])

  /* Přechod na jinou stránku: odložená nová verze se načte teď (nic
     rozepsaného tu ještě není). Chráněné stránky hlídá `bezpecneZnovunacist`. */
  useEffect(() => {
    dohnatRef.current?.()
  }, [pathname])

  return null
}

export default SessionVersionWatch
