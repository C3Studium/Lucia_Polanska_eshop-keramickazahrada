import { useEffect, useLayoutEffect, useRef } from "react"
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
 * ## Co se roluje
 *
 * NE okno. Skořápka administrace je `h-screen overflow-hidden` a posuvník má
 * `<main>` uvnitř ní — `window.scrollY` je tam pořád nula a `window.scrollTo`
 * nedělá nic. První verze proto tiše nefungovala (opraveno 9. 11. 2026).
 * Hledá se tedy první předek s vlastním posuvníkem; kdyby žádný nebyl
 * (jiná skořápka, test), spadne se zpátky na okno.
 *
 * Posuvník se hledá podle `overflow-y` ve stylu, ne podle aktuální výšky:
 * při připojení komponenty je stránka ještě krátká a podle výšky by to
 * vyšlo pokaždé jinak.
 *
 * ## Proč sessionStorage, a ne stav v paměti
 *
 * Odchod na detail komponentu odmontuje, takže paměť nepřežije. Adresa se
 * k tomu nehodí — pozice posuvníku není nic, co by se mělo objevit v odkazu
 * ani v historii. Sezení prohlížeče je přesně ta životnost, kterou tohle
 * potřebuje: drží přes navigaci, zmizí se zavřením panelu.
 *
 * ## Proč se pamět při kliknutí zamrazí
 *
 * Tady byla druhá tichá chyba (změřeno 9. 11. 2026): pozice se ukládala
 * správně — 1100 — a při odchodu ji někdo přepsal nulou.
 *
 * Vinit se nabízí bourání stránky, ale měření ukázalo něco jiného: 69 ms po
 * kliknutí přišlo „zarolováno na nulu" u posuvníku, jehož obsah se ani
 * nezměnil, a naše stránka zmizela až o 136 ms později. To není srovnání
 * zkráceného obsahu, to si nativní detail objednávky roluje nahoru. Takže
 * „poslední viděná pozice" nestačí — mezi kliknutím a odchodem se stihne
 * stát ledacos.
 *
 * Rozhoduje tedy pozice ve chvíli KLIKNUTÍ: kliknutí je okamžik, kdy člověk
 * odchází, a nic po něm už o jeho místě ve výpisu nevypovídá. Od kliknutí se
 * proto rolování ignoruje. Rozmrazí ho až vlastní pohyb — kolečko, dotyk,
 * klávesa nebo chycení posuvníku — protože to zase znamená, že nikam nešel
 * a čte dál.
 *
 * Odhlašujeme se k tomu v „layout" fázi, ještě při potvrzování změn: úklid
 * `useEffect` React plánuje přes scheduler, klidně až po vykreslení, a to je
 * na zprávy o rolování pozdě.
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

/**
 * Jak dlouho čekat, než se výpis dorovná do potřebné výšky.
 *
 * Při návratu je obvykle hotovo hned (data drží mezipaměť dotazů), ale po
 * studeném načtení se dvě stě položek chvíli skládá. Čtyři vteřiny jsou
 * kompromis: déle už by skok působil, jako by stránka žila vlastním životem —
 * a vlastní pohyb ho stejně kdykoli zastaví.
 */
const NEJDELE_MS = 4000

const klicPro = (stranka: string, adresa: string) =>
  `kz-scroll:${stranka}:${adresa}`

/** Co v administraci skutečně roluje — a jak se toho zeptat. */
type Rolovatko = {
  /** Kde je posuvník teď. */
  pozice: () => number
  /** Skočit na danou pozici, bez animace. */
  skoc: (na: number) => void
  /** Kam až se dá dorolovat — dokud je míň než uložená pozice, čeká se. */
  dosah: () => number
  /** Na čem poslouchat pohyb posuvníku. */
  cil: HTMLElement | Window
}

const maVlastniPosuvnik = (prvek: HTMLElement): boolean => {
  const smer = window.getComputedStyle(prvek).overflowY
  return smer === "auto" || smer === "scroll"
}

const najdiRolovatko = (): Rolovatko => {
  /* `<main>` je obsahová část skořápky; posuvník má ona nebo některý
     z jejích obalů. */
  const start = document.querySelector<HTMLElement>("main")
  for (let prvek = start; prvek; prvek = prvek.parentElement) {
    if (maVlastniPosuvnik(prvek)) {
      const nalezeny = prvek
      return {
        pozice: () => nalezeny.scrollTop,
        skoc: (na) =>
          nalezeny.scrollTo({ top: na, behavior: "instant" as ScrollBehavior }),
        dosah: () => nalezeny.scrollHeight - nalezeny.clientHeight,
        cil: nalezeny,
      }
    }
  }
  return {
    pozice: () => window.scrollY,
    skoc: (na) => window.scrollTo({ top: na, behavior: "instant" as ScrollBehavior }),
    dosah: () => document.documentElement.scrollHeight - window.innerHeight,
    cil: window,
  }
}

export const useScrollMemory = (stranka: string): void => {
  const location = useLocation()
  const adresa = location.pathname + location.search
  const klic = klicPro(stranka, adresa)
  /* Ref, ne stav: změna by překreslovala výpis při každém pohybu posuvníku. */
  const obnovaBezi = useRef(true)
  /* Poslední pozice, kterou jsme opravdu VIDĚLI od posuvníku. */
  const videno = useRef<number | null>(null)

  /* ── zapamatovat ──────────────────────────────────────────────────── */
  useLayoutEffect(() => {
    const rolovatko = najdiRolovatko()
    /* Jiná adresa = jiný výpis; co jsme viděli u toho minulého, sem nepatří. */
    videno.current = null
    let zamrzlo = false

    const zapis = (kam: number) => {
      try {
        sessionStorage.setItem(klic, String(kam))
      } catch {
        /* Soukromé okno nebo zakázané úložiště — pozice se prostě nepamatuje. */
      }
    }
    const poznamenej = () => {
      const kam = Math.round(rolovatko.pozice())
      videno.current = kam
      zapis(kam)
    }
    const sleduj = () => {
      if (zamrzlo) return
      poznamenej()
    }
    /* Kliknutí = odchod. Co se s posuvníkem stane potom, už není její pohyb. */
    const zmrazit = () => {
      poznamenej()
      zamrzlo = true
    }
    /* Vlastní pohyb znamená, že nikam nešla a čte dál. */
    const rozmrazit = () => {
      zamrzlo = false
    }
    const vlastniPohyb = ["wheel", "touchstart", "keydown", "mousedown"] as const

    /* Pasivně: zápis nesmí zdržovat rolování. */
    rolovatko.cil.addEventListener("scroll", sleduj, { passive: true })
    /* Zachytávání: chceme vědět o kliknutí dřív, než se podle něj zařídí
       zbytek administrace. */
    window.addEventListener("click", zmrazit, true)
    for (const udalost of vlastniPohyb) {
      window.addEventListener(udalost, rozmrazit, { passive: true, capture: true })
    }

    return () => {
      /* Nejdřív přestat poslouchat, teprve pak zapsat — pořadí je tu to
         podstatné, viz vysvětlení výš. */
      rolovatko.cil.removeEventListener("scroll", sleduj)
      window.removeEventListener("click", zmrazit, true)
      for (const udalost of vlastniPohyb) {
        window.removeEventListener(udalost, rozmrazit, true)
      }
      if (videno.current !== null) zapis(videno.current)
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

    const rolovatko = najdiRolovatko()
    obnovaBezi.current = true
    const stop = () => {
      obnovaBezi.current = false
    }
    /* Vlastní pohyb má přednost — jakmile zaroluje sama, přestáváme.
       Posloucháme na okně: události z vnitřního posuvníku k němu bublají. */
    window.addEventListener("wheel", stop, { passive: true, once: true })
    window.addEventListener("touchstart", stop, { passive: true, once: true })
    window.addEventListener("keydown", stop, { once: true })

    const zacatek = Date.now()
    let snimek = 0
    const zkus = () => {
      if (!obnovaBezi.current) return
      if (rolovatko.dosah() >= ulozena) {
        rolovatko.skoc(ulozena)
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
