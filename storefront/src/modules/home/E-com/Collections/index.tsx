"use client"
import { HorizontalItem, VerticalItem } from "./item"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  useScroll,
  motion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion"

const collections = [
  {
    id: 1,
    title: "Do zahrady",
    description: "Kusy, které venku hezky zestárnou spolu se zahradou.",
    image: "/assets/img/img/7.jpg",
    href: "/store",
    item: VerticalItem,
  },
  {
    id: 2,
    title: "Novinky",
    description: "Co právě vyšlo z pece v píseckém ateliéru.",
    image: "/assets/img/img/10.jpg",
    href: "/store",
    item: HorizontalItem,
  },
  {
    id: 3,
    title: "Drobnosti",
    description: "Malé kousky, které mají svůj výraz i charakter.",
    image: "/assets/img/img/1.jpg",
    href: "/store",
    item: HorizontalItem,
  },
  {
    id: 4,
    title: "Květinové reliéfy",
    description: "Keramika podle toho, co roste za oknem.",
    image: "/assets/img/img/7.jpg",
    href: "/store",
    item: VerticalItem,
  },
  {
    id: 5,
    title: "Figurální tvorba",
    description: "Tváře a postavy. Modeluju je bez formy, vždycky jen jednou.",
    image: "/assets/img/img/4.jpg",
    href: "/store",
    item: HorizontalItem,
  },
  {
    id: 6,
    title: "Do interiéru",
    description: "Výrobky, které se hodí na polici, ke stolu i na parapet.",
    image: "/assets/img/img/8.jpg",
    href: "/store",
    item: HorizontalItem,
  },
]
// najít způsob jak správně lokalizovat kolekce, tak aby byly správně za sebou s jejich obrázky, ty se asi budou muset přidat.
// Nejdříve sem vrazit kolekce, potom zjisit kde jaká je, potom doplnit obrázkem a textem.

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
const CARDS_SETTLED = 0.62
const RAIL_END = 0.72
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

type CollectionType = (typeof collections)[number]
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
  spread,
  progress,
  index,
  total,
}: {
  collection: CollectionType
  spread: SpreadConfig
  progress: MotionValue<number>
  index: number
  total: number
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
      style={{ x, y, rotate, scale, opacity }}
    >
      <collection.item collection={collection} />
    </motion.div>
  )
}

export default function Collections() {
  const ref = useRef(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
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

      setTravel({
        from: Math.min(stage.clientWidth * 0.18, overflow * 0.4 + 48),
        to: -overflow,
      })
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    observer.observe(rail)

    return () => observer.disconnect()
  }, [])

  const xRaw = useTransform(
    scrollYProgress,
    [0, RAIL_END, 1],
    [travel.from, travel.to, travel.to]
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

  const itemSpread = useMemo(
    () =>
      collections.map((collection, index) => {
        const side = index % 2 === 0 ? -1 : 1
        const spread = deterministicRandom(collection.id + index * 2.13)
        const depth = deterministicRandom(collection.id * 1.77 + index * 0.39)

        return {
          startX: side * (28 + spread * 48),
          midX: side * (10 + spread * 14),
          endX: side * (2 + spread * 4),
          startY: (depth - 0.5) * 28,
          endY: (depth - 0.5) * 8,
          startRotate: side * (0.8 + spread * 1.5),
        }
      }),
    []
  )

  return (
    <section
      className="Collections"
      ref={ref}
      id="home-collections"
      data-scroll-section
      data-scroll-label="Kolekce"
    >
      <motion.div className="sticky" style={{ clipPath: sceneClipRaw }}>
        <motion.div
          className="Collections__exitCurtain"
          style={{ clipPath: exitCurtain, scale: curtainScale }}
          aria-hidden="true"
        />
        <motion.div
          ref={stageRef}
          className="sticky__Wrapper"
          style={{ y, scale: wrapperScale, opacity: sceneOpacity }}
        >
          <motion.div className="header" style={{ y: headerY }}>
            <div className="header__meta">
              <span>03 · Kolekce</span>
              <span>Ručně tvořeno v Písku</span>
            </div>
            <h2>
              Stejný postup, <em>pokaždé jiný výsledek.</em>
            </h2>
            <p>Pracuju bez formy, takže se mi dva stejné kusy udělat ani nepodaří.</p>
          </motion.div>
          <motion.div ref={railRef} className="Collecion__wrapper" style={{ x }}>
            {collections.map((collection, index) => (
              <CollectionCardMotion
                key={collection.id}
                collection={collection}
                progress={scrollYProgress}
                index={index}
                total={collections.length}
                spread={itemSpread[index] ?? itemSpread[0]}
              />
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  )
}
