"use client"
import { editable } from "@c3studium/valecms/edit"
import { HorizontalItem, VerticalItem, type CollectionCard } from "./item"
import type { NavigationCollection } from "@modules/layout/Navbar/productsButton"
import { useEffect, useMemo, useRef, useState } from "react"
import { useDeviceTier } from "@lib/hooks/use-device-tier"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import type { CopyBlock } from "@lib/util/site-copy"
import {
  useScroll,
  motion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion"

/**
 * Záložní fotka, když ji nemá ani CMS, ani Medusa.
 *
 * Karta bez obrázku je díra v mřížce, ne prázdné místo — `next/image` navíc bez `src` spadne.
 */
const FALLBACK_IMAGE = "/assets/img/img/7.jpg"

/**
 * Střídání podob karet: svislá, vodorovná, vodorovná — dokola.
 *
 * Odvozené z pořadí, ne zapsané u každé kolekce. Seznam kolekcí přichází z Medusy a mění se
 * podle toho, co si majitelka založí v adminu; kdyby si podobu nesla položka, musel by ji
 * někdo doplňovat ke každé nové kolekci a mřížka by se rozpadla u té první zapomenuté.
 */
const itemFor = (index: number) =>
  index % 3 === 0 ? VerticalItem : HorizontalItem

/**
 * Handle kolekce z její adresy. Jím se páruje řádek v CMS.
 *
 * Adresa je `/store?collection=<handle>` (viz `catalogueHref`), takže handle je v DOTAZU,
 * ne v cestě — čtení posledního úseku cesty by u všech kolekcí vrátilo „store" a všechny
 * karty by dostaly popisek prvního řádku.
 */
const handleOf = (href: string): string => {
  const query = new URLSearchParams(href.split("?")[1] ?? "")
  return query.get("collection") ?? query.get("category") ?? ""
}

const springConfig = {
  stiffness: 92,
  damping: 24,
  mass: 0.7,
}

/*
 * One clock for the whole stage, written down so the beats can be read at a glance.
 *
 * The old distribution never resolved: the last card's own timeline ran to 1.0 while the scene
 * was already fading out from 0.84 and the curtain closing from 0.78, so the set was never once
 * settled and still. Cards now finish at CARDS_SETTLED, the rail lands shortly after, and there
 * is a beat where the whole thing simply stands there before the exit takes it.
 */
/*
 * Karty dosednou a rail doputuje v PRVNÍ půlce přišepnuté scény, ne ke konci.
 *
 * Bylo 0.62 / 0.72 na 210vh sekci: rail dojel a skoro hned na to začal odchod (0.90), takže
 * mezi „hotovo" a „pryč" nebylo skoro nic a další sekce nastupovala do ještě dojíždějícího
 * pohybu. Teď sekce měří 300vh (viz style.scss) a podíly jsou menší — dráha railu tím vyjde
 * DELŠÍ v pixelech (0.58 × 200vh ≈ 116vh proti dřívějším 0.72 × 110vh ≈ 79vh) a přitom skončí
 * mnohem dřív před odepnutím: zbyde 0.58 → 0.90, tedy asi 64vh, kdy scéna prostě stojí.
 *
 * Rail dojíždí kousek za kartami, ne s nimi — poslední, co se hýbe, je celek, ne jeho části.
 */
const CARDS_SETTLED = 0.5
/*
 * Rail se rozjede AŽ po přišpendlení, ne při náběhu sekce.
 *
 * Scroll-rozsah téhle scény začíná dřív, než se scéna zastaví (`offset: ["start 0.6", …]`),
 * takže bez vlastního startu se skoro 40 % dráhy railu odjelo ještě cestou nahoru — změřeno:
 * ve chvíli, kdy se scéna zastavila, byla první karta už skoro na svém místě a jelo se jen
 * dobrzdit. 0.24 je právě ten okamžik zastavení (na 1600×900 vycházel podíl 0.225).
 *
 * Do té chvíle rail stojí odsunutý vpravo. Celá cesta první kolekce doleva se tak odehraje
 * před očima, ne mimo obraz.
 */
const RAIL_START = 0.24
const RAIL_END = 0.66
/*
 * The exit holds almost to the release point (0.86 → 0.93 → 0.90 as tuned
 * with Matěj): curtain rises 0.90–0.97, cards fade 0.93–0.985 — both settle
 * a hair BEFORE the pin releases, so the seam never pops mid-move. The
 * scroll-off itself is no longer dead: the curtain keeps scaling (see
 * leaveProgress) and Courses' stage leads up over it.
 */
const EXIT_START = 0.9
const EXIT_END = 0.97

const deterministicRandom = (seed: number) => {
  const x = Math.sin(seed * 999.91) * 10000
  return x - Math.floor(x)
}

type SpreadConfig = {
  startX: number
  midX: number
  endX: number
  startY: number
  endY: number
  startRotate: number
}

function CollectionCardMotion({
  collection,
  block,
  badge,
  action,
  spread,
  progress,
  index,
  total,
  isPhone,
}: {
  collection: CollectionCard
  /** Jen kvůli sdíleným textům na kartě (štítek, text odkazu) — data karty jsou z Medusy. */
  block?: CopyBlock
  badge: string
  action: string
  spread: SpreadConfig
  progress: MotionValue<number>
  index: number
  total: number
  isPhone: boolean
}) {
  const segment = CARDS_SETTLED / total
  const overlap = segment * 0.42
  const start = Math.max(0, index * segment - overlap)
  const end = Math.min(CARDS_SETTLED, (index + 1) * segment + overlap)

  // Local timeline per item, with overlap to avoid "one-by-one" robotic pacing.
  const localProgress = useTransform(progress, [start, end], [0, 1])

  const xRaw = useTransform(
    localProgress,
    [0, 0.75, 1],
    [spread.startX, spread.midX, 0]
  )
  const yRaw = useTransform(
    localProgress,
    [0, 0.85, 1],
    [spread.startY, spread.endY, 0]
  )
  const rotateRaw = useTransform(
    localProgress,
    [0, 0.7, 1],
    [spread.startRotate, spread.startRotate * 0.2, 0]
  )
  const scaleRaw = useTransform(localProgress, [0, 0.2, 1], [0.93, 0.975, 1])
  const opacityRaw = useTransform(localProgress, [0, 0.2, 1], [0.72, 0.96, 1])

  const x = useSpring(xRaw, springConfig)
  const y = useSpring(yRaw, springConfig)
  const rotate = useSpring(rotateRaw, {
    stiffness: 82,
    damping: 21,
    mass: 0.75,
  })
  const scale = useSpring(scaleRaw, { stiffness: 88, damping: 22, mass: 0.75 })
  const opacity = useSpring(opacityRaw, {
    stiffness: 95,
    damping: 26,
    mass: 0.7,
  })

  return (
    <motion.div
      className="collection__cardMotion"
      /* On a phone the cards are a plain column, so there is nothing for a scroll-linked spread
         and rotation to spread against — and five cards each running five springs off the scroll
         position is the most expensive thing on the page for no visible result. */
      style={isPhone ? undefined : { x, y, rotate, scale, opacity }}
    >
      {/* Podoba karty je odvozená z pořadí — viz `itemFor`. */}
      {(() => {
        const Item = itemFor(index)
        return (
          <Item
            collection={collection}
            block={block}
            index={index}
            badge={badge}
            action={action}
          />
        )
      })()}
    </motion.div>
  )
}

export default function Collections({
  block,
  collections: source = [],
}: {
  block?: CopyBlock
  /** Kolekce z Medusy — jméno, odkaz a fotka. Viz `listNavigationCollections`. */
  collections?: NavigationCollection[]
}) {
  /* Sekce se překresluje jen z MotionValues (scroll), a ty překreslení nespouštějí — bez
     tohohle by `editable()` zůstalo prázdné a texty by v editoru nešly chytit. Viz hook. */
  useEditRerender()

  const railLeft = block?.accent?.[0]?.trim() || "03 · Kolekce"
  const railRight = block?.accent?.[1]?.trim() || "Ručně tvořeno v Písku"
  const headlineLead = block?.title?.trim() || "Stejný postup,"
  const headlineAccent = block?.headline?.trim() || "pokaždé jiný výsledek."
  const lede =
    block?.bodyText?.trim() ||
    "Pracuju bez formy, takže se mi dva stejné kusy udělat ani nepodaří."
  const badge = block?.accent?.[2]?.trim() || "Originál · malá série"
  const action = block?.accent?.[3]?.trim() || "Otevřít kolekci"

  /*
   * Karty jsou celé z Medusy — jméno, odkaz, fotka i popisek.
   *
   * Popisek a fotka se nastavují v adminu Rozdělení, v panelu „Zobrazit kolekci". Původně
   * byly v CMS a s kolekcí se párovaly přes handle; u kolekce bydlí proto, že kolekce je
   * katalog — když se přejmenuje nebo smaže, má se s ní hnout i její věta a obrázek. Přes
   * dva systémy to jinak než ručním úklidem nešlo, a na ten se zapomene.
   *
   * V CMS zůstaly jen texty, které ke konkrétní kolekci nepatří: nadpis sekce, lišta,
   * štítek na kartě a text odkazu.
   */
  const cards = useMemo(
    () =>
      source.map((collection, index) => ({
        key: handleOf(collection.href) || collection.id,
        n: index + 1,
        title: collection.title,
        description: collection.description ?? "",
        image: collection.image || FALLBACK_IMAGE,
        href: collection.href,
      })),
    [source]
  )

  const ref = useRef(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)

  /*
   * The whole section is one scroll-driven scene: 210vh of page pins a viewport-high stage and
   * walks a four-column rail sideways through it. That is a composition for a wide window — on a
   * phone the rail is ~2030px of grid behind a 390px hole, so most of the collections cannot be
   * reached at any scroll position, and the sideways travel fights the vertical scroll that
   * drives it. Here it is a plain column instead.
   */
  const { isPhone } = useDeviceTier()
  const [travel, setTravel] = useState({ from: 0, to: 0 })
  const { scrollYProgress: localScrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.6", "end end"],
  })
  const scrollYProgress = localScrollYProgress
  /* The scroll-off phase: pin release → section gone. The curtain used to be
     a dead flat surface for that whole viewport of scroll; a slow scale keeps
     it breathing while Courses slides up over it (Matěj, 2026-08-14). */
  const { scrollYProgress: leaveProgress } = useScroll({
    target: ref,
    offset: ["end end", "end start"],
  })
  const curtainScale = useTransform(leaveProgress, [0, 1], [1, 1.06])

  /*
   * The rail is a fixed four-column grid, ~2030px wide whatever the screen. The old keyframes
   * carried it from 24vw to -1.5vw, which on a 1440x780 laptop left the last two collections
   * ~590px past the right edge for the entire section — they could not be seen at any scroll
   * position, and it got worse the narrower the window. Measuring the actual overflow means the
   * stage always walks the whole rail through the window, and travels no further than it needs to.
   */
  useEffect(() => {
    const stage = stageRef.current
    const rail = railRef.current

    if (!stage || !rail) {
      return
    }

    const measure = () => {
      // Below 760px the rail is a native horizontal scroller (see style.scss); translating it as
      // well would fight the thumb.
      if (getComputedStyle(rail).overflowX !== "visible") {
        setTravel({ from: 0, to: 0 })
        return
      }

      const overflow = Math.max(0, rail.scrollWidth - stage.clientWidth)

      /*
       * Start dál vpravo, aby první kolekce doletěla doleva až za dlouho.
       *
       * Bylo `0.18 × šířka scény` proti `0.4 × přesah`, což na 1600px okně dávalo asi 288px —
       * první karta stála skoro na místě a hned se zabrzdila o levý okraj. Zdvojnásobené
       * podíly ji posunou zhruba na 450px, takže na začátku je z ní vidět jen kus a přijíždí
       * celou dobu.
       *
       * Pořád je to `min` ze dvou mezí, každá hlídá jiný okraj: podíl ze scény drží kartu
       * aspoň částečně v obraze i na širokém monitoru, podíl z přesahu nedovolí odsunout ji
       * dál, než kolik má rail vůbec kam couvat.
       */
      setTravel({
        from: Math.min(stage.clientWidth * 0.34, overflow * 0.6 + 64),
        to: -overflow,
      })
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    observer.observe(rail)

    return () => observer.disconnect()
  }, [])

  /* Čtyři body: stát vpravo → jet → stát vlevo. Prostřední úsek je celý uvnitř přišpendlení
     a poslední je ta pauza, po které teprve nastupuje odchod scény (EXIT_START). */
  const xRaw = useTransform(
    scrollYProgress,
    [0, RAIL_START, RAIL_END, 1],
    [travel.from, travel.from, travel.to, travel.to]
  )
  const yRaw = useTransform(scrollYProgress, [0, 1], ["3%", "-2%"])
  const wrapperScaleRaw = useTransform(
    scrollYProgress,
    [0, 0.2, EXIT_START, 1],
    [0.985, 1, 1, 0.976]
  )
  const headerYRaw = useTransform(scrollYProgress, [0, 1], ["0%", "3%"])
  const sceneOpacityRaw = useTransform(
    scrollYProgress,
    [0, 0.08, 0.93, 0.985],
    [0, 1, 1, 0]
  )
  const sceneClipRaw = useTransform(
    scrollYProgress,
    [0, 0.12],
    ["inset(7% 2.5% 0% 2.5%)", "inset(0% 0% 0% 0%)"]
  )
  const exitCurtain = useTransform(
    scrollYProgress,
    [EXIT_START, EXIT_END],
    ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  )

  const x = useSpring(xRaw, springConfig)
  const y = useSpring(yRaw, springConfig)
  const wrapperScale = useSpring(wrapperScaleRaw, {
    stiffness: 95,
    damping: 24,
    mass: 0.7,
  })
  const headerY = useSpring(headerYRaw, {
    stiffness: 85,
    damping: 24,
    mass: 0.7,
  })
  const sceneOpacity = useSpring(sceneOpacityRaw, {
    stiffness: 92,
    damping: 26,
    mass: 0.65,
  })

  /* Rozptyl visí na POŘADÍ, ne na id: kolekce z Medusy mají id jako řetězec (`pcol_…`)
     a aritmetika nad ním by dala `NaN`, tedy karty bez posunu. */
  const itemSpread = useMemo(
    () =>
      cards.map((_, index) => {
        const side = index % 2 === 0 ? -1 : 1
        const spread = deterministicRandom((index + 1) + index * 2.13)
        const depth = deterministicRandom((index + 1) * 1.77 + index * 0.39)

        return {
          startX: side * (28 + spread * 48),
          midX: side * (10 + spread * 14),
          endX: side * (2 + spread * 4),
          startY: (depth - 0.5) * 28,
          endY: (depth - 0.5) * 8,
          startRotate: side * (0.8 + spread * 1.5),
        }
      }),
    [cards]
  )

  return (
    <section
      className="Collections"
      ref={ref}
      id="home-collections"
      /*
       * Layout and motion branch on the same flag rather than on a media query beside it. Keyed
       * separately they could disagree — a vertical column still being walked sideways by a
       * scroll-linked `x` — and there is no width at which that is a layout anyone chose.
       */
      data-phone={isPhone || undefined}
      data-scroll-section
      data-scroll-label="Kolekce"
    >
      <motion.div
        className="sticky"
        style={isPhone ? undefined : { clipPath: sceneClipRaw }}
      >
        <motion.div
          className="Collections__exitCurtain"
          style={isPhone ? undefined : { clipPath: exitCurtain, scale: curtainScale }}
          aria-hidden="true"
        />
        <motion.div
          ref={stageRef}
          className="sticky__Wrapper"
          style={isPhone ? undefined : { y, scale: wrapperScale, opacity: sceneOpacity }}
        >
          <motion.div
            className="header"
            style={isPhone ? undefined : { y: headerY }}
          >
            <div className="header__meta">
              <span {...editable(block, "accent.0")}>{railLeft}</span>
              <span {...editable(block, "accent.1")}>{railRight}</span>
            </div>
            {/* Obě půlky nadpisu jsou VLASTNÍ pole, ne jeden text rozdělený značkou.
                `editable` zapisuje vždy celé pole, takže dvě věty v jednom poli by měly
                jeden společný rámeček a upravovaly by se jen obě naráz. */}
            <h2>
              <span {...editable(block, "title")}>{headlineLead}</span>{" "}
              <em {...editable(block, "headline")}>{headlineAccent}</em>
            </h2>
            <p {...editable(block, "body")}>{lede}</p>
          </motion.div>
          <motion.div
            ref={railRef}
            className="Collecion__wrapper"
            style={isPhone ? undefined : { x }}
          >
            {cards.map((card, index) => (
              <CollectionCardMotion
                key={card.key}
                collection={card}
                block={block}
                badge={badge}
                action={action}
                progress={scrollYProgress}
                index={index}
                total={cards.length}
                spread={itemSpread[index] ?? itemSpread[0]}
                isPhone={isPhone}
              />
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  )
}
