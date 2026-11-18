"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

import {
  BUILD_STAMP,
  CART_PENDING_KEY,
  CART_VERSION_ENDPOINT,
  RELOAD_GUARD_KEY,
  VERSION_ENDPOINT,
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
 * Ptá se při návratu k záložce, při každém přechodu na jinou stránku
 * a jednou za minutu (18. 11. 2026, dřív pět minut — majitel chce novou
 * verzi u lidí hned). Dotaz jen na viditelné záložce, takže mobil na
 * pozadí se kvůli němu nebudí.
 */
const INTERVAL_MS = 60 * 1000

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
  const zkontrolovatRef = useRef<(() => Promise<void>) | null>(null)

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

  useEffect(() => {
    // Bez otisku není s čím porovnávat — build proběhl mimo náš skript.
    if (!BUILD_STAMP) return

    let zruseno = false

    const zkontrolovat = async () => {
      if (zruseno || document.visibilityState !== "visible") return

      let stamp: string | undefined

      try {
        const odpoved = await fetch(VERSION_ENDPOINT, { cache: "no-store" })
        if (!odpoved.ok) return
        stamp = (await odpoved.json())?.stamp
      } catch {
        // Offline nebo restart serveru. Zeptáme se příště.
        return
      }

      if (zruseno || !stamp || stamp === BUILD_STAMP) return

      /*
       * Pojistka proti smyčce. Při postupném nasazení může chvíli vedle sebe
       * běžet stará i nová instance a odpovědi se střídají — bez tohohle by
       * se záložka načítala dokola.
       */
      try {
        if (window.localStorage.getItem(RELOAD_GUARD_KEY) === stamp) return
      } catch {
        return
      }

      if (!bezpecneZnovunacist()) return

      zruseno = true

      // Pořadí: úklid maže i klíče s předponou `kz:`, tedy i tuhle pojistku.
      clearAppStorage()
      try {
        window.localStorage.setItem(RELOAD_GUARD_KEY, stamp)
      } catch {
        // Bez úložiště se pojistka nezapíše; smyčku hlídá `zruseno`.
      }

      window.location.reload()
    }

    const priNavratu = () => {
      if (document.visibilityState === "visible") void zkontrolovat()
    }

    document.addEventListener("visibilitychange", priNavratu)
    const timer = window.setInterval(() => void zkontrolovat(), INTERVAL_MS)
    zkontrolovatRef.current = zkontrolovat

    return () => {
      zruseno = true
      zkontrolovatRef.current = null
      document.removeEventListener("visibilitychange", priNavratu)
      window.clearInterval(timer)
    }
  }, [])

  /* Přechod na jinou stránku je nejbezpečnější chvíle: nic rozepsaného
     tu ještě není. Chráněné stránky hlídá `bezpecneZnovunacist`. */
  useEffect(() => {
    void zkontrolovatRef.current?.()
  }, [pathname])

  return null
}

export default SessionVersionWatch
