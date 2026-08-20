"use client"

import MouseAnim from "@modules/common/components/MouseAnim"
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion"

import { heroBeat, heroReveal } from "@lib/motion-tokens"
import Image from "next/image"
import { useRef, useState } from "react"
import type { SanityImageSource } from "@sanity/image-url/lib/types/types"
import { urlFor } from "../../../../sanity/lib/image"
import ContactTrigger from "@modules/layout/ContactDialog/trigger"
import WebButton from "@modules/common/components/Buttons/webButton"

export type KurzyIntroData = {
  content?: string
  images?: SanityImageSource[]
} | null

/*
 * Scene order: what a course is → who it is for.
 *
 * The pinned timeline used to run four scenes (hero → O kurzech → děti →
 * dospělí). The last two repeated what the audience blocks now say in one
 * screen and ended on „připravujeme" — a dead end, when the page finally has
 * a live reservation section below. So the timeline is two scenes: the hero,
 * and one „Pro koho" scene with a short popisek and exactly three blocks —
 * děti a školy, firmy a spolky, zájemci. The first two open the contact
 * dialog; the third walks you down to the terms and the booking form.
 */
const fallbackLede =
  "V ateliéru u Písku vedu keramické kurzy pro děti i dospělé. Malé skupiny, klidné tempo a výrobek, který si odnesete domů."

const fallbackAbout =
  "Na kurzu si hlínu osaháte pomalu a bez spěchu. Provedu vás celým procesem — od výběru hlíny přes modelování až po glazování a výpal. Každý si najde svůj vlastní způsob a odnese si kousek, který nikde jinde neseženete."

const audienceBlocks = [
  {
    number: "01",
    eyebrow: "Školy · Školky · Kroužky",
    title: "Pro děti",
    accent: "a školy.",
    text: "Program a délku přizpůsobím věku skupiny. U hlíny se děti samy zklidní a odnesou si vlastní výrobek.",
    action: "contact" as const,
    cta: "Napište mi",
  },
  {
    number: "02",
    eyebrow: "Teambuilding · Společné tvoření",
    title: "Pro firmy",
    accent: "a spolky.",
    text: "Pár klidných hodin u hlíny místo porady. Termín a náplň domluvíme podle vaší skupiny.",
    action: "contact" as const,
    cta: "Napište mi",
  },
  {
    number: "03",
    eyebrow: "Jednotlivci · Dvojice · Malé skupiny",
    title: "Pro zájemce",
    accent: "o kurz.",
    text: "Vypsané termíny s cenami a volnými místy najdete níže — místo si rezervujete rovnou.",
    action: "reserve" as const,
    cta: "Vybrat termín",
  },
]

/*
 * Beats of the pinned stage. Two scenes now, so each gets roughly the same
 * physical scroll it had before (the stage shrank from 560svh to 300svh):
 * the hero holds, leaves as one piece, and only then does „Pro koho" arrive.
 */
const HERO_HOLD = 0.21
const HERO_OUT = 0.44
const ABOUT_IN = 0.47

export default function Intro({
  data,
  onReserveAction,
}: {
  data?: KurzyIntroData
  /** „Pro zájemce → Vybrat termín" — opens the reservation modal. */
  onReserveAction: () => void
}) {
  const timelineRef = useRef<HTMLElement>(null)
  const [activeScene, setActiveScene] = useState(0)

  /* Reduced motion (layer 2 of the site's 3-layer scheme): the scenes still
     swap with scroll, but purely as crossfades — no parallax, no sliding,
     no scaling, no spring overshoot. Fades stay; movement goes. */
  const reduceMotion = useReducedMotion()

  const { scrollYProgress: rawScrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start start", "end end"],
  })
  const smoothedScrollYProgress = useSpring(rawScrollYProgress, {
    stiffness: 145,
    damping: 38,
    mass: 0.28,
    restDelta: 0.001,
  })
  const scrollYProgress = reduceMotion
    ? rawScrollYProgress
    : smoothedScrollYProgress

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const scene = progress < 0.455 ? 0 : 1
    setActiveScene((current) => (current === scene ? current : scene))
  })

  const background = useTransform(
    scrollYProgress,
    [0, 0.32, 0.49, 1],
    ["#1d1e1a", "#1d1e1a", "#f3e7da", "#f3e7da"]
  )
  const ambientX = useTransform(
    scrollYProgress,
    [0, 0.45, 1],
    ["24vw", "-18vw", "15vw"]
  )
  const ambientY = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    ["-12vh", "16vh", "-8vh"]
  )
  const ambientColor = useTransform(
    scrollYProgress,
    [0, 0.42, 0.55, 1],
    [
      "rgba(211, 106, 57, .2)",
      "rgba(211, 106, 57, .12)",
      "rgba(255, 232, 214, .78)",
      "rgba(255, 232, 214, .32)",
    ]
  )

  /* The hero leaves as one piece — nothing fades in underneath it. */
  const heroOpacity = useTransform(
    scrollYProgress,
    [0, HERO_HOLD + 0.11, HERO_OUT],
    [1, 1, 0]
  )
  const heroY = useTransform(
    scrollYProgress,
    [0, HERO_HOLD + 0.11, HERO_OUT],
    ["0vh", "0vh", "-7vh"]
  )
  const heroScale = useTransform(
    scrollYProgress,
    [0, HERO_HOLD + 0.11, HERO_OUT],
    [1, 1, 0.965]
  )
  /* The lockup steps aside for the copy over a comfortable stretch of scroll. */
  const heroTitleX = useTransform(
    scrollYProgress,
    [0, 0.08, 0.25, HERO_OUT],
    ["0vw", "0vw", "-15vw", "-17vw"]
  )
  const heroTitleY = useTransform(
    scrollYProgress,
    [0, 0.08, 0.25, HERO_OUT],
    ["0vh", "0vh", "0vh", "-3vh"]
  )
  const heroTitleScale = useTransform(
    scrollYProgress,
    [0, 0.08, 0.25, HERO_OUT],
    [1, 1, 0.76, 0.73]
  )

  const image1 = useTransform(
    scrollYProgress,
    [0, 0.075, 0.16, 0.29, 0.38],
    ["0vw", "24vw", "24vw", "24vw", "0vw"]
  )
  const image2 = useTransform(
    scrollYProgress,
    [0.035, 0.14, 0.225, 0.29, 0.38],
    ["0vw", "0vw", "24vw", "24vw", "0vw"]
  )
  const image3 = useTransform(
    scrollYProgress,
    [0.1, 0.2, 0.29, 0.325, 0.38],
    ["0vw", "0vw", "24vw", "24vw", "0vw"]
  )
  /* Arrives once the lockup has cleared its column, stays for the rest of the hero. */
  const heroCopyOpacity = useTransform(
    scrollYProgress,
    [0.165, 0.29, HERO_HOLD + 0.14, HERO_OUT - 0.02],
    [0, 1, 1, 0]
  )
  const heroCopyY = useTransform(
    scrollYProgress,
    [0.165, 0.29, HERO_OUT - 0.02],
    [26, 0, -14]
  )

  const aboutOpacity = useTransform(
    scrollYProgress,
    [ABOUT_IN, ABOUT_IN + 0.11, 1],
    [0, 1, 1]
  )
  const aboutY = useTransform(
    scrollYProgress,
    [ABOUT_IN, ABOUT_IN + 0.11, 1],
    ["4vh", "0vh", "0vh"]
  )
  const aboutHeadingX = useTransform(
    scrollYProgress,
    [ABOUT_IN + 0.02, ABOUT_IN + 0.15, 1],
    [-26, 0, 0]
  )
  const aboutLedeY = useTransform(
    scrollYProgress,
    [ABOUT_IN + 0.055, ABOUT_IN + 0.185, 1],
    [24, 0, 0]
  )
  const aboutLedeOpacity = useTransform(
    scrollYProgress,
    [ABOUT_IN + 0.055, ABOUT_IN + 0.185],
    [0, 1]
  )

  const progressScale = useTransform(scrollYProgress, [0, 1], [0.03, 1])

  const images = [
    data?.images?.[0] ? urlFor(data.images[0]).url() : "/assets/img/img/2.jpg",
    data?.images?.[1] ? urlFor(data.images[1]).url() : "/assets/img/img/3.jpg",
    data?.images?.[2] ? urlFor(data.images[2]).url() : "/assets/img/img/5.jpg",
  ]

  return (
    <section
      className="kurzyTimeline"
      ref={timelineRef}
      id="kurzy"
      data-scroll-section
      data-scroll-label="Kurzy"
    >
      <motion.div
        className="kurzyTimeline__stage"
        style={{ backgroundColor: background }}
      >
        <motion.div
          className="kurzyTimeline__ambient"
          style={
            reduceMotion
              ? { backgroundColor: ambientColor }
              : { x: ambientX, y: ambientY, backgroundColor: ambientColor }
          }
          aria-hidden="true"
        />

        <motion.article
          className={`kurzyScene kurzyHero${
            activeScene === 0 ? " is-active" : ""
          }`}
          style={
            reduceMotion
              ? { opacity: heroOpacity }
              : { opacity: heroOpacity, y: heroY, scale: heroScale }
          }
          aria-labelledby="kurzy-hero-title"
        >
          <SceneMeta
            left="Kurzy · Keramická zahrada"
            right="Písek · Malé skupiny"
          />

          <motion.div
            className="kurzyHero__title"
            style={
              reduceMotion
                ? undefined
                : { x: heroTitleX, y: heroTitleY, scale: heroTitleScale }
            }
            aria-hidden="true"
          >
            <HeroTitleRow
              before="Ku"
              after="rzy"
              width={reduceMotion ? "24vw" : image1}
              src={images[0]}
              alt=""
              label="01 · Materiál"
            />
            <HeroTitleRow
              before="Kur"
              after="zy"
              width={reduceMotion ? "24vw" : image2}
              src={images[1]}
              alt=""
              label="02 · Vlastní tvar"
            />
            <HeroTitleRow
              before="Kurz"
              after="y"
              width={reduceMotion ? "24vw" : image3}
              src={images[2]}
              alt=""
              label="03 · Radost"
            />
          </motion.div>

          <motion.div
            className="kurzyHero__copy"
            style={
              reduceMotion
                ? { opacity: heroCopyOpacity }
                : { opacity: heroCopyOpacity, y: heroCopyY }
            }
          >
            {/* Entrance on the children, not this element: its opacity and y are scroll-driven
                motion values, and those win over `animate` for the same property. */}
            <motion.span
              variants={heroReveal}
              initial={reduceMotion ? false : "hidden"}
              animate="show"
              custom={heroBeat.eyebrow}
            >
              Keramické kurzy · 01
            </motion.span>
            <motion.h1
              id="kurzy-hero-title"
              variants={heroReveal}
              initial={reduceMotion ? false : "hidden"}
              animate="show"
              custom={heroBeat.heading}
            >
              U hlíny se nedá spěchat.
              <em>A to je na tom to nejlepší.</em>
            </motion.h1>
            <motion.p
              variants={heroReveal}
              initial={reduceMotion ? false : "hidden"}
              animate="show"
              custom={heroBeat.lede}
            >
              {fallbackLede}
            </motion.p>
          </motion.div>

          <motion.div
            className="kurzyHero__scrollCue"
            aria-hidden="true"
            variants={heroReveal}
            initial={reduceMotion ? false : "hidden"}
            animate="show"
            custom={heroBeat.chrome}
          >
            <MouseAnim />
            <span>Pojďte dál</span>
          </motion.div>
        </motion.article>

        <motion.section
          className={`kurzyScene kurzyAbout${
            activeScene === 1 ? " is-active" : ""
          }`}
          style={
            reduceMotion
              ? { opacity: aboutOpacity }
              : { opacity: aboutOpacity, y: aboutY }
          }
          aria-labelledby="kurzy-about-title"
        >
          <SceneMeta left="02 · Pro koho" right="Děti · Firmy · Zájemci" />

          <motion.header
            className="kurzyAbout__intro"
            style={reduceMotion ? undefined : { x: aboutHeadingX }}
          >
            <span>Kurzy pro každého</span>
            <h2 id="kurzy-about-title">
              Nejdřív hlína.
              <em>Potom nápad.</em>
            </h2>
          </motion.header>

          <motion.div
            className="kurzyAbout__lede"
            style={
              reduceMotion
                ? { opacity: aboutLedeOpacity }
                : { y: aboutLedeY, opacity: aboutLedeOpacity }
            }
          >
            <p>{data?.content || fallbackAbout}</p>
          </motion.div>

          <div className="kurzyAbout__blocks">
            {audienceBlocks.map((block, index) => (
              <AudienceBlock
                key={block.number}
                block={block}
                progress={scrollYProgress}
                index={index}
                onReserve={onReserveAction}
              />
            ))}
          </div>
        </motion.section>

        <footer
          className={`kurzyTimeline__rail kurzyTimeline__rail--${
            activeScene + 1
          }`}
        >
          <span>01 · Kurzy</span>
          <span>02 · Pro koho</span>
          <i>
            <motion.b style={{ scaleX: progressScale }} />
          </i>
        </footer>
      </motion.div>
    </section>
  )
}

function SceneMeta({ left, right }: { left: string; right: string }) {
  return (
    <header className="kurzySceneMeta">
      <span>{left}</span>
      <i />
      <span>{right}</span>
    </header>
  )
}

function HeroTitleRow({
  before,
  after,
  width,
  src,
  alt,
  label,
}: {
  before: string
  after: string
  /** A scroll-driven motion value, or a fixed width under reduced motion. */
  width: MotionValue<string> | string
  src: string
  alt: string
  label: string
}) {
  return (
    <div className="kurzyHero__titleRow">
      <span>{before}</span>
      <motion.figure style={{ width }}>
        <Image src={src} alt={alt} fill sizes="24vw" priority />
        <figcaption>{label}</figcaption>
      </motion.figure>
      <span>{after}</span>
    </div>
  )
}

function AudienceBlock({
  block,
  progress,
  index,
  onReserve,
}: {
  block: (typeof audienceBlocks)[number]
  progress: MotionValue<number>
  index: number
  onReserve: () => void
}) {
  /* All three arrive a beat apart, left to right, inside the scene's entrance. */
  const reduceMotion = useReducedMotion()
  const start = ABOUT_IN + 0.03 + index * 0.045
  const settled = start + 0.1

  const opacity = useTransform(progress, [start, settled, 1], [0, 1, 1])
  const y = useTransform(progress, [start, settled, 1], [30, 0, 0])

  return (
    <motion.article
      className="kurzyAudience"
      style={reduceMotion ? { opacity } : { opacity, y }}
    >
      <div className="kurzyAudience__number">
        <span>{block.number}</span>
        <i />
      </div>
      <span className="kurzyAudience__eyebrow">{block.eyebrow}</span>
      <h3>
        {block.title}
        <em>{block.accent}</em>
      </h3>
      <p>{block.text}</p>
      <div className="kurzyAudience__action">
        {block.action === "contact" ? (
          <ContactTrigger
            text={block.cta}
            topic="Kurzy"
            className="kurzyTimelineCtaButton"
          />
        ) : (
          <WebButton
            Kind="Button"
            title={block.cta}
            className="kurzyTimelineCtaButton"
            onClickAction={onReserve}
          />
        )}
      </div>
    </motion.article>
  )
}
