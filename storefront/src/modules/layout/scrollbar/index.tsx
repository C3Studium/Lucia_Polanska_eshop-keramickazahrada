"use client"

import { motion, useSpring } from "framer-motion"
import { usePathname } from "next/navigation"
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import { useDeviceTier } from "@lib/hooks/use-device-tier"
import styles from "./style.module.scss"

/*
 * Posuvník, který vypadá jako posuvník.
 *
 * Tady dřív stála svislá lišta z vlásků — jedna čárka na sekci, mezi nimi
 * jemnější dílky a popisek na najetí. Vypadalo to dobře a nefungovalo to:
 * nikdo v ní posuvník nepoznal. Zpětná vazba od první čtenářky nezněla „ta
 * lišta se mi nelíbí", ale „na ntb mi chybí pravá lišta pro posun dolů" —
 * tedy žádná tam není. Nativní posuvník je přitom schovaný (globals.scss),
 * takže stránka vypadala, jako by se nedala rolovat jinak než šipkami.
 *
 * Proto tahle verze drží tvar, který lidi znají: dráha u pravé hrany a v ní
 * úchop, jehož VÝŠKA říká, jak velký kus stránky je vidět, a POLOHA, kde se
 * člověk nachází. Dá se chytit a táhnout, dá se do dráhy kliknout, jede na
 * šipkách. Z původní lišty zůstalo to, co bylo navíc a stálo za to: popisek
 * sekce — jen se z ozdoby stal náhled, kam klik skočí.
 *
 * Pohyb nese pružina (`useSpring`), ne přímý zápis: kolečko chodí v trhaných
 * skocích po ~100 px a úchop by poskakoval s ním. Při tažení se pružina
 * obchází (`jump`), protože tam má úchop sedět pod prstem na pixel přesně.
 *
 * Na dotyku lišta nebyla vůbec (`display: none`). Teď se chová tak, jak jsou
 * lidé z telefonu zvyklí: ukáže se při posunu, po chvíli zmizí — a dá se
 * chytit.
 */

/** Nejmenší úchop, který se dá trefit prstem. Pod tím už to není ovladač. */
const NEJMENSI_UCHOP = 44

/** Jak dlouho po posledním posunu zůstane lišta na dotyku vidět. */
const SKRYT_PO_MS = 1100

/** Krok šipek; PageUp/Down a Home/End mají vlastní. */
const KROK_SIPKY = 120

type Metrika = {
  /** Výška dráhy v px. */
  draha: number
  /** Výška úchopu v px — podíl okna na celé stránce. */
  uchop: number
  /** Kolik px zbývá k odrolování. 0 = stránka se vejde do okna. */
  rozsah: number
}

type Sekce = {
  /** Vzdálenost od začátku dokumentu v px. */
  od: number
  label: string
}

const PRAZDNA: Metrika = { draha: 0, uchop: 0, rozsah: 0 }

/*
 * Sekce slouží JEN popisku, takže se hledají až při prvním najetí na lištu
 * a pak znovu při změně stránky. Původní verze je přeměřovala při každém
 * snímku scrollu — na telefonu to byl největší kus práce, který nebyl vidět.
 */
const najdiSekce = (): Sekce[] => {
  const vlastni = Array.from(
    document.querySelectorAll<HTMLElement>("[data-scroll-section]")
  )
  const zdroj = vlastni.length
    ? vlastni
    : Array.from(
        document.querySelectorAll<HTMLElement>(
          "main > section, main > [role='region']"
        )
      )

  return zdroj
    .filter((prvek) => {
      const styl = window.getComputedStyle(prvek)
      return styl.display !== "none" && prvek.offsetHeight > 1
    })
    .map((prvek, poradi) => ({
      od: prvek.getBoundingClientRect().top + window.scrollY,
      label:
        prvek.dataset.scrollLabel ||
        prvek.getAttribute("aria-label") ||
        "Sekce " + (poradi + 1),
    }))
    .sort((a, b) => a.od - b.od)
}

const popisekPro = (sekce: Sekce[], pozice: number): string => {
  if (!sekce.length) return ""
  let nalezena = sekce[0]
  for (const kus of sekce) {
    if (kus.od <= pozice + 1) nalezena = kus
  }
  return nalezena.label
}

const charAnim = {
  hidden: { opacity: 0, x: "0.85em" },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
} as const

const labelAnim = {
  hidden: { transition: { staggerChildren: 0.012, staggerDirection: 1 } },
  visible: {
    transition: {
      delayChildren: 0.035,
      staggerChildren: 0.026,
      staggerDirection: -1,
    },
  },
} as const

export default function Scrollbar() {
  const pathname = usePathname()
  const { isTouch } = useDeviceTier()

  const drahaRef = useRef<HTMLDivElement | null>(null)
  const metrikaRef = useRef<Metrika>(PRAZDNA)
  const sekceRef = useRef<Sekce[] | null>(null)
  const snimekRef = useRef<number | null>(null)
  const tahaniRef = useRef<{ odsazeni: number } | null>(null)
  const casovacRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [metrika, setMetrika] = useState<Metrika>(PRAZDNA)
  const [aktivni, setAktivni] = useState(false)
  const [taha, setTaha] = useState(false)
  const [vidiSe, setVidiSe] = useState(true)
  const [popisek, setPopisek] = useState("")

  /*
   * Pružina drží POLOHU úchopu v px. Tuhost a tlumení jsou zvolené tak, aby
   * jeden zub kolečka doběhl dřív, než přijde další (~100 ms) — jinak by se
   * zpoždění sčítala a úchop by se za stránkou plazil.
   */
  const y = useSpring(0, { stiffness: 520, damping: 48, mass: 0.55 })

  const zmer = useCallback(() => {
    const korenovy = document.documentElement
    const okno = window.innerHeight
    const celek = Math.max(korenovy.scrollHeight, okno)
    const rozsah = Math.max(0, celek - okno)
    const draha = drahaRef.current?.clientHeight ?? 0
    const uchop =
      rozsah > 0 && draha > 0
        ? Math.max(NEJMENSI_UCHOP, Math.min(draha, (okno / celek) * draha))
        : 0

    const dalsi: Metrika = { draha, uchop, rozsah }
    const stara = metrikaRef.current
    metrikaRef.current = dalsi

    if (
      Math.abs(stara.draha - draha) > 0.5 ||
      Math.abs(stara.uchop - uchop) > 0.5 ||
      Math.abs(stara.rozsah - rozsah) > 0.5
    ) {
      setMetrika(dalsi)
    }

    return dalsi
  }, [])

  /** Přepočítá polohu úchopu z aktuálního scrollu. */
  const srovnej = useCallback(
    (skokem = false) => {
      const { draha, uchop, rozsah } = metrikaRef.current
      if (rozsah <= 0 || draha <= 0) return

      const dil = Math.min(1, Math.max(0, window.scrollY / rozsah))
      const cil = dil * (draha - uchop)

      /*
       * Procento pro čtečku se píše rovnou do atributu, ne přes stav.
       * Ve stavu by každý snímek rolování překreslil celou komponentu —
       * i popisek, který je rozložený na jednotlivá písmena. Přesně tahle
       * práce dělala z předchozí lišty na telefonu to nejdražší, co nebylo
       * vidět; pohyb úchopu nese `transform`, a ten React nepotřebuje.
       */
      drahaRef.current?.setAttribute("aria-valuenow", String(Math.round(dil * 100)))

      if (skokem) y.jump(cil)
      else y.set(cil)
    },
    [y]
  )

  /*
   * Měří se při příchodu na stránku, při změně velikosti okna i při každé
   * změně výšky dokumentu: obrázky dotečou až po prvním vykreslení a do té
   * doby je stránka o několik oken kratší, takže by úchop byl na začátku
   * mnohem vyšší, než jak skončí.
   */
  useEffect(() => {
    sekceRef.current = null
    zmer()
    srovnej(true)

    const pozorovatel = new ResizeObserver(() => {
      zmer()
      srovnej()
    })
    pozorovatel.observe(document.documentElement)
    if (document.body) pozorovatel.observe(document.body)

    return () => pozorovatel.disconnect()
  }, [pathname, zmer, srovnej])

  useEffect(() => {
    const prekresli = () => {
      if (snimekRef.current !== null) return
      snimekRef.current = window.requestAnimationFrame(() => {
        snimekRef.current = null
        /* Při tažení píše polohu ukazatel, ne scroll — jinak by si ty dva
           zdroje úchop přetahovaly a ten by se třásl. */
        if (!tahaniRef.current) srovnej()
      })
    }

    const priPosunu = () => {
      prekresli()
      if (!isTouch) return

      setVidiSe(true)
      if (casovacRef.current) clearTimeout(casovacRef.current)
      casovacRef.current = setTimeout(() => setVidiSe(false), SKRYT_PO_MS)
    }

    const priZmene = () => {
      zmer()
      prekresli()
    }

    window.addEventListener("scroll", priPosunu, { passive: true })
    window.addEventListener("resize", priZmene)

    return () => {
      window.removeEventListener("scroll", priPosunu)
      window.removeEventListener("resize", priZmene)
      if (snimekRef.current !== null) {
        window.cancelAnimationFrame(snimekRef.current)
      }
      if (casovacRef.current) clearTimeout(casovacRef.current)
    }
  }, [isTouch, srovnej, zmer])

  /* Na myši je lišta vidět pořád — o to tu celé jde. Přepnutí na dotyk
     a zpátky (tablet s klávesnicí) ji nesmí nechat schovanou natrvalo. */
  useEffect(() => {
    if (!isTouch) setVidiSe(true)
  }, [isTouch])

  /** Scroll odpovídající poloze úchopu, v px od začátku dokumentu. */
  const scrollZPolohy = useCallback((px: number) => {
    const { draha, uchop, rozsah } = metrikaRef.current
    const dostupne = Math.max(1, draha - uchop)
    const dil = Math.min(1, Math.max(0, px / dostupne))
    return dil * rozsah
  }, [])

  const polohaZUkazatele = useCallback((klientY: number, odsazeni: number) => {
    const hrana = drahaRef.current?.getBoundingClientRect()
    if (!hrana) return 0
    const { uchop } = metrikaRef.current
    const syrova = klientY - hrana.top - odsazeni
    return Math.min(Math.max(0, syrova), Math.max(0, hrana.height - uchop))
  }, [])

  const ukazPopisek = useCallback((cilovyScroll: number) => {
    if (sekceRef.current === null) sekceRef.current = najdiSekce()
    setPopisek(popisekPro(sekceRef.current, cilovyScroll))
  }, [])

  const priStisku = (event: ReactPointerEvent<HTMLDivElement>) => {
    const { draha, uchop, rozsah } = metrikaRef.current
    if (rozsah <= 0 || draha <= 0) return

    event.preventDefault()
    const hrana = drahaRef.current?.getBoundingClientRect()
    if (!hrana) return

    const naUchopu = (event.target as HTMLElement).closest("[data-uchop]")
    /* Klik do prázdné dráhy chytá úchop za střed: stránka skočí přesně tam,
       kam ukazatel míří, a tažení pak pokračuje bez dalšího poskočení. */
    const odsazeni = naUchopu ? event.clientY - hrana.top - y.get() : uchop / 2

    tahaniRef.current = { odsazeni }
    setTaha(true)
    event.currentTarget.setPointerCapture(event.pointerId)

    const poloha = polohaZUkazatele(event.clientY, odsazeni)
    y.jump(poloha)
    const cil = scrollZPolohy(poloha)
    ukazPopisek(cil)
    scrollWithLenis(cil, { immediate: true, offset: 0 })
  }

  const priTazeni = (event: ReactPointerEvent<HTMLDivElement>) => {
    const tah = tahaniRef.current

    if (!tah) {
      /* Jen náhled: popisek míří tam, kam by klik skočil. */
      const poloha = polohaZUkazatele(
        event.clientY,
        metrikaRef.current.uchop / 2
      )
      ukazPopisek(scrollZPolohy(poloha))
      return
    }

    const poloha = polohaZUkazatele(event.clientY, tah.odsazeni)
    y.jump(poloha)
    const cil = scrollZPolohy(poloha)
    ukazPopisek(cil)
    scrollWithLenis(cil, { immediate: true, offset: 0 })
  }

  const konecTazeni = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!tahaniRef.current) return
    tahaniRef.current = null
    setTaha(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    srovnej()
  }

  const priKlavese = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const { rozsah } = metrikaRef.current
    if (rozsah <= 0) return

    const okno = window.innerHeight
    const posun: Record<string, number> = {
      ArrowDown: KROK_SIPKY,
      ArrowUp: -KROK_SIPKY,
      PageDown: okno * 0.9,
      PageUp: -okno * 0.9,
    }

    let cil: number | null = null
    if (event.key === "Home") cil = 0
    else if (event.key === "End") cil = rozsah
    else if (posun[event.key] !== undefined) cil = window.scrollY + posun[event.key]

    if (cil === null) return
    event.preventDefault()
    scrollWithLenis(Math.min(Math.max(0, cil), rozsah), { offset: 0 })
  }

  /*
   * Stránka, která se vejde do okna, posuvník nepotřebuje — prázdná dráha
   * u hrany by jen mátla. Nevrací se ale `null`: dráha se musí vykreslit,
   * aby se dala změřit. Schová ji `data-vidi`.
   */
  const kDispozici = metrika.rozsah > 0 && metrika.uchop > 0
  const popisekVidet = Boolean(popisek) && (aktivni || taha)

  return (
    <div
      className={styles.listva}
      data-vidi={kDispozici && vidiSe ? "ano" : "ne"}
      data-dotyk={isTouch ? "ano" : "ne"}
      data-aktivni={aktivni || taha ? "ano" : undefined}
    >
      <div
        ref={drahaRef}
        className={styles.draha}
        role="scrollbar"
        tabIndex={kDispozici ? 0 : -1}
        aria-label="Posuvník stránky"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        onPointerEnter={() => setAktivni(true)}
        onPointerLeave={() => {
          setAktivni(false)
          if (!tahaniRef.current) setPopisek("")
        }}
        onPointerDown={priStisku}
        onPointerMove={priTazeni}
        onPointerUp={konecTazeni}
        onPointerCancel={konecTazeni}
        onKeyDown={priKlavese}
      >
        <motion.div
          className={styles.uchop}
          data-uchop=""
          style={{ y, height: metrika.uchop }}
        >
          <motion.span
            className={styles.popisek}
            variants={labelAnim}
            initial="hidden"
            animate={popisekVidet ? "visible" : "hidden"}
            data-videt={popisekVidet || undefined}
            aria-hidden="true"
          >
            {Array.from(popisek).map((znak, poradi) => (
              <motion.i variants={charAnim} key={znak + "-" + poradi}>
                {znak === " " ? " " : znak}
              </motion.i>
            ))}
          </motion.span>
        </motion.div>
      </div>
    </div>
  )
}
