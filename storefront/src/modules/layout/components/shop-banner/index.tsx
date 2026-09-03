"use client"

import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ShopStatus } from "@lib/data/shop-status"
import WebButton from "@modules/common/components/Buttons/webButton"
import styles from "./style.module.scss"

/**
 * The owner's voice, fixed to the bottom edge.
 *
 * Messages come from the backend (vacation first, then announcements). The ✕ dismisses —
 * remembered in localStorage keyed by the CONTENT, so a new message reappears even for someone
 * who closed the last one.
 *
 * ## Proč smyčka, a ne střídání po šesti vteřinách
 *
 * Dřív se zprávy přepínaly každých 6 s a mezi nimi se prolnuly. Teď jedou v jednom pásu dokola,
 * stejně jako oznámení v heru — je to tatáž informace na tomtéž webu, takže se má chovat stejně.
 * Střídání navíc znamenalo, že druhá zpráva prostě půl minuty neexistuje; ve smyčce jsou obě
 * pořád, jen popojíždějí.
 *
 * Technika je shodná s pásem v heru: obsah je v DOMu DVAKRÁT a posouvá se o −50 %. Ve chvíli,
 * kdy první kopie odjede přesně celá, stojí druhá na jejím místě — návrat na nulu je tentýž
 * obraz, takže skok není vidět. Druhá kopie je proto `aria-hidden`; pro čtečku je to duplikát.
 *
 * ## Proč až za herem
 *
 * Na úvodní stránce nese oznámení už samo hero a dva pásy s toutéž větou přes sebe jsou zmatek,
 * ne důraz. Pruh se proto drží stranou, dokud je hero na obrazovce, a najede, až když sjedete
 * pryč. Na stránkách bez hera (což jsou všechny ostatní) není na co čekat a je vidět hned.
 */
const HEIGHT_VAR = "--shop-banner-height"

/** Sekce hera na úvodní stránce — viz `modules/home/Hero/index.tsx`. */
const HERO_ID = "home-atelier"

export default function ShopBanner({ status }: { status: ShopStatus | null }) {
  const messages = useMemo(() => {
    const list: { text: string; link?: string | null }[] = []
    if (status?.vacation) {
      const until = status.vacation.until
        ? ` Zakázky přijímáme znovu po ${status.vacation.until
            .split("-")
            .reverse()
            .join(". ")}.`
        : ""
      list.push({ text: `${status.vacation.message}${until}` })
    }
    if (status?.announcement)
      list.push({
        text: status.announcement.message,
        link: status.announcement.link ?? null,
      })
    return list
  }, [status])

  const storageKey = useMemo(
    () => `kz-banner-dismissed:${messages.map((m) => m.text).join("|")}`,
    [messages]
  )

  const [dismissed, setDismissed] = useState(true)
  const [pastHero, setPastHero] = useState(false)
  const barRef = useRef<HTMLDivElement | null>(null)
  const publishedRef = useRef<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    if (!messages.length) return
    try {
      setDismissed(localStorage.getItem(storageKey) === "1")
    } catch {
      setDismissed(false)
    }
  }, [messages, storageKey])

  /*
   * Je hero pryč z obrazovky?
   *
   * `IntersectionObserver`, ne posluchač scrollu: odpověď na „je tenhle prvek vidět" počítá
   * prohlížeč sám, mimo hlavní vlákno, a je správná i tehdy, když stránkou nehýbe scrollbar,
   * ale `transform` — což je přesně případ úvodní stránky s Lenisem a vodorovnými sekcemi.
   * Počítat pozici z `scrollY` by tady dávalo špatné číslo.
   *
   * Závislost na `pathname` je nutná: tenhle pruh visí v layoutu, takže se při přechodu mezi
   * stránkami NEODMONTUJE. Bez ní by si po odchodu z úvodní stránky pamatoval poslední odpověď
   * o heru, které už na stránce není, a zůstal by schovaný.
   */
  useEffect(() => {
    const hero = document.getElementById(HERO_ID)

    // Stránka bez hera — není na co čekat. Totéž když prohlížeč pozorovatele nezná.
    if (!hero || typeof IntersectionObserver === "undefined") {
      setPastHero(true)
      return
    }

    setPastHero(false)
    const observer = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [pathname])

  const hidden = !messages.length || dismissed || !pastHero

  /*
   * Publish the bar's height on `:root` — see HEIGHT_VAR above.
   *
   * ResizeObserver rather than a one-off read, because the height changes without the bar
   * remounting: a longer message wraps to a second line, and the padding hangs on `vh`, so
   * rotating the device changes it too.
   *
   * The write goes straight to the DOM and never into state — publishing a number that a parent
   * would re-render on is how a resize turns into a render loop. `publishedRef` holds the last
   * string written so an observation that changed nothing costs nothing, and so a hypothetical
   * feedback path (something reading the variable and resizing the bar) settles instead of
   * oscillating. Reading the variable never resizes the bar, so this is belt and braces.
   */
  useEffect(() => {
    const root = document.documentElement
    const el = barRef.current

    const withdraw = () => {
      root.style.removeProperty(HEIGHT_VAR)
      publishedRef.current = null
    }

    if (hidden || !el) {
      withdraw()
      return
    }

    const publish = () => {
      const next = `${Math.round(el.getBoundingClientRect().height)}px`
      if (next === publishedRef.current) return
      publishedRef.current = next
      root.style.setProperty(HEIGHT_VAR, next)
    }

    publish()

    if (typeof ResizeObserver === "undefined") return withdraw

    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      withdraw()
    }
  }, [hidden])

  if (hidden) return null

  /* Odkaz nese jen oznámení, a jen když ho majitelka vyplnila. Když ho má víc zpráv, vezme se
     první — tlačítko je jedno a dvě adresy neunese. */
  const withLink = messages.find((m) => m.link)

  /*
   * Jedna funkce pro obě kopie pásu.
   *
   * Kopie musí být znak po znaku stejné, jinak se posun o −50 % netrefí a smyčka viditelně
   * poskočí. Dvě samostatně psané větve značek by to nedržely — rozešly by se při první úpravě,
   * kterou někdo udělá jen v té horní.
   */
  const line = (copy: "first" | "second") => (
    <span className={styles.line} aria-hidden={copy === "second"}>
      {messages.map((message, i) => (
        <span key={`${copy}-${i}`} className={styles.item}>
          {message.text}
        </span>
      ))}
    </span>
  )

  return (
    <div className={styles.banner} role="status" ref={barRef}>
      {/* Odkaz stojí MIMO posuvnou část. Musí být trefitelný, a cíl, který ujíždí, se trefit
          nedá — zvlášť na dotyku. Stejné rozvržení jako pás v heru: odkaz vlevo, pás vpravo. */}
      {withLink?.link && (
        <WebButton
          Kind="Link"
          tone="dark"
          title="Víc informací"
          href={withLink.link}
          className={styles.action}
        />
      )}

      {/* Maska drží pás uvnitř své šířky; kdyby přetékal, rozšířil by stránku. */}
      <div className={styles.viewport}>
        <div className={styles.track}>
          {line("first")}
          {/* Druhá kopie: bez ní by po odjetí první zůstala mezera. */}
          {line("second")}
        </div>
      </div>

      <button
        type="button"
        className={styles.close}
        aria-label="Skrýt oznámení"
        onClick={() => {
          setDismissed(true)
          try {
            localStorage.setItem(storageKey, "1")
          } catch {
            // Private windows forbid storage; hiding for the visit is enough.
          }
        }}
      >
        ✕
      </button>
    </div>
  )
}
