import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"

/**
 * Vrátit člověka tam, kde ve výpisu byl.
 *
 * ## Proč
 *
 * Majitelka prochází katalog kus po kuse: otevře produkt, upraví, vrátí se —
 * a výpis začíná zase nahoře. U dvou set položek to znamená u každého kusu
 * znovu dorolovat. Je to tatáž potíž jako se ztraceným výběrem kolekce
 * (viz `lib/url-state`), jen o patro níž: tam se ztrácelo CO je vidět, tady
 * KDE v tom byla (8. 11. 2026).
 *
 * ## Proč sessionStorage, a ne stav v paměti
 *
 * Odchod na detail komponentu odmontuje, takže paměť nepřežije. Adresa se
 * k tomu nehodí — pozice posuvníku není nic, co by se mělo objevit v odkazu
 * ani v historii. Sezení prohlížeče je přesně ta životnost, kterou tohle
 * potřebuje: drží přes navigaci, zmizí se zavřením panelu.
 *
 * ## Proč se obnovuje opakovaně, a ne jednou
 *
 * Výpis se načítá ze serveru, takže v okamžiku připojení komponenty ještě
 * není co rolovat — stránka je krátká a skok by skončil na jejím konci,
 * tedy skoro nahoře. Zkouší se tedy znovu v každém snímku, dokud stránka
 * nevyroste na potřebnou výšku, nejdéle vteřinu a půl. Pak to vzdá: lepší
 * zůstat nahoře než poskakovat po stránce, kterou si člověk mezitím začal
 * číst.
 *
 * Jakmile člověk sám zaroluje, obnovování se zastaví — jeho pohyb má vždycky
 * přednost před naším.
 */

/** Jak dlouho čekat, než se výpis dorovná do potřebné výšky. */
const NEJDELE_MS = 1500

const klicPro = (stranka: string, adresa: string) =>
  `kz-scroll:${stranka}:${adresa}`

export const useScrollMemory = (stranka: string): void => {
  const location = useLocation()
  const adresa = location.pathname + location.search
  const klic = klicPro(stranka, adresa)
  /* Ref, ne stav: změna by překreslovala výpis při každém pohybu posuvníku. */
  const obnovaBezi = useRef(true)

  /* ── zapamatovat ──────────────────────────────────────────────────── */
  useEffect(() => {
    const zapis = () => {
      try {
        sessionStorage.setItem(klic, String(Math.round(window.scrollY)))
      } catch {
        /* Soukromé okno nebo zakázané úložiště — pozice se prostě nepamatuje. */
      }
    }
    /* Pasivně: zápis nesmí zdržovat rolování. */
    window.addEventListener("scroll", zapis, { passive: true })
    return () => {
      /* Ještě při odchodu, ať se uloží i poslední pohyb před kliknutím. */
      zapis()
      window.removeEventListener("scroll", zapis)
    }
  }, [klic])

  /* ── obnovit ──────────────────────────────────────────────────────── */
  useEffect(() => {
    let ulozena = 0
    try {
      ulozena = Number(sessionStorage.getItem(klic) ?? 0)
    } catch {
      return
    }
    if (!Number.isFinite(ulozena) || ulozena <= 0) return

    obnovaBezi.current = true
    const stop = () => {
      obnovaBezi.current = false
    }
    /* Vlastní pohyb má přednost — jakmile zaroluje sama, přestáváme. */
    window.addEventListener("wheel", stop, { passive: true, once: true })
    window.addEventListener("touchstart", stop, { passive: true, once: true })
    window.addEventListener("keydown", stop, { once: true })

    const zacatek = Date.now()
    let snimek = 0
    const zkus = () => {
      if (!obnovaBezi.current) return
      const dosah = document.documentElement.scrollHeight - window.innerHeight
      if (dosah >= ulozena) {
        window.scrollTo({ top: ulozena, behavior: "instant" as ScrollBehavior })
        return
      }
      if (Date.now() - zacatek > NEJDELE_MS) return
      snimek = window.requestAnimationFrame(zkus)
    }
    snimek = window.requestAnimationFrame(zkus)

    return () => {
      window.cancelAnimationFrame(snimek)
      window.removeEventListener("wheel", stop)
      window.removeEventListener("touchstart", stop)
      window.removeEventListener("keydown", stop)
    }
  }, [klic])
}
