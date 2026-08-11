"use client"

import MouseAnim from "@modules/common/components/MouseAnim"
import {
  motion,
  useMotionValueEvent,
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

export type KurzyIntroData = {
  content?: string
  images?: SanityImageSource[]
} | null

/*
 * Scene order: what a course is → courses for children → courses for adults.
 *
 * It used to run hero → children → the three process steps → adults, which explained *who* a
 * course was for before it explained *what one is*, and buried the general description in a
 * 29vw column of the hero that only faded in halfway through the first scene's scroll and out
 * again a moment later. The three steps now sit together in one "O kurzech" scene as a strip,
 * which is both the answer to "what is this" and three screens shorter.
 */
const fallbackLede =
  "V ateliéru u Písku vedu keramické kurzy pro děti i dospělé. Malé skupiny, klidné tempo a výrobek, který si odnesete domů."

const fallbackAbout =
  "Na kurzu si hlínu osaháte pomalu a bez spěchu. Provedu vás celým procesem — od výběru hlíny přes modelování až po glazování a výpal. Nikomu nic nepředepisuju: každý si najde svůj vlastní způsob a odnese si kousek, který nikde jinde neseženete."

const courseSteps = [
  {
    number: "01",
    eyebrow: "První setkání",
    title: "Poznat materiál",
    accent: "dotekem.",
    text: "Hlína reaguje na tlak, vodu, nástroje i trpělivost. Napřed si zvyknete na ni, ona na vás.",
    src: "/assets/img/roller/2h.jpg",
    alt: "Keramický detail vzniklý ruční prací",
  },
  {
    number: "02",
    eyebrow: "Vlastní rukopis",
    title: "Najít vlastní tvar",
    accent: "bez předlohy.",
    text: "Na hotovém kusu je pak vidět, čí ruce ho dělaly — i s tou drobnou nedokonalostí.",
    src: "/assets/img/roller/3v.jpg",
    alt: "Ručně modelovaný keramický výrobek",
  },
  {
    number: "03",
    eyebrow: "Po výpalu",
    title: "Odnést si radost",
    accent: "domů.",
    text: "Po glazování a výpalu se z nápadu stane opravdová věc do domu nebo na zahradu.",
    src: "/assets/img/roller/4h.jpg",
    alt: "Hotový keramický výrobek v zahradě",
  },
]

/*
 * Beats of the pinned stage. Written down together because the handover between two scenes is the
 * one thing that has to be read as a pair: the outgoing scene is gone before the incoming one
 * starts. The previous version faded the hero out over 0.24–0.30 while the workshop faded in over
 * 0.235–0.30 — the same stretch — so the middle of every transition was two half-transparent
 * scenes stacked on top of each other, with the giant title lockup showing through the copy.
 */
const HERO_HOLD = 0.11
const HERO_OUT = 0.235
const ABOUT_IN = 0.25
const ABOUT_OUT = 0.5
const KIDS_IN = 0.515
const KIDS_OUT = 0.765
const ADULTS_IN = 0.78

export default function Intro({ data }: { data?: KurzyIntroData }) {
  const timelineRef = useRef<HTMLElement>(null)
  const [activeScene, setActiveScene] = useState(0)

  const { scrollYProgress: rawScrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start start", "end end"],
  })
  const scrollYProgress = useSpring(rawScrollYProgress, {
    stiffness: 145,
    damping: 38,
    mass: 0.28,
    restDelta: 0.001,
  })

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const scene =
      progress < 0.24 ? 0 : progress < 0.51 ? 1 : progress < 0.775 ? 2 : 3
    setActiveScene((current) => (current === scene ? current : scene))
  })

  const background = useTransform(
    scrollYProgress,
    [0, 0.17, 0.26, 0.45, 0.53, 0.71, 0.79, 1],
    [
      "#1d1e1a",
      "#1d1e1a",
      "#f3e7da",
      "#f3e7da",
      "#9b9a70",
      "#9b9a70",
      "#24251f",
      "#24251f",
    ]
  )
  const ambientX = useTransform(
    scrollYProgress,
    [0, 0.32, 0.58, 0.82, 1],
    ["24vw", "-18vw", "15vw", "30vw", "8vw"]
  )
  const ambientY = useTransform(
    scrollYProgress,
    [0, 0.35, 0.7, 1],
    ["-12vh", "16vh", "-8vh", "12vh"]
  )
  const ambientColor = useTransform(
    scrollYProgress,
    [0, 0.25, 0.38, 0.6, 0.78, 1],
    [
      "rgba(211, 106, 57, .2)",
      "rgba(211, 106, 57, .12)",
      "rgba(255, 232, 214, .78)",
      "rgba(255, 232, 214, .32)",
      "rgba(202, 113, 73, .22)",
      "rgba(202, 113, 73, .1)",
    ]
  )

  /* The hero leaves as one piece — no scene is fading in underneath it any more, so it can take
     its time going rather than being rushed off in the 0.06 it used to share with the next one. */
  const heroOpacity = useTransform(
    scrollYProgress,
    [0, HERO_HOLD + 0.06, HERO_OUT],
    [1, 1, 0]
  )
  const heroY = useTransform(
    scrollYProgress,
    [0, HERO_HOLD + 0.06, HERO_OUT],
    ["0vh", "0vh", "-7vh"]
  )
  const heroScale = useTransform(
    scrollYProgress,
    [0, HERO_HOLD + 0.06, HERO_OUT],
    [1, 1, 0.965]
  )
  /* The lockup still steps aside for the copy, but over 0.09 of scroll instead of 0.035 — at the
     old rate it crossed 16vw and lost a quarter of its size inside about a fifth of a screen. */
  const heroTitleX = useTransform(
    scrollYProgress,
    [0, 0.045, 0.135, HERO_OUT],
    ["0vw", "0vw", "-15vw", "-17vw"]
  )
  const heroTitleY = useTransform(
    scrollYProgress,
    [0, 0.045, 0.135, HERO_OUT],
    ["0vh", "0vh", "0vh", "-3vh"]
  )
  const heroTitleScale = useTransform(
    scrollYProgress,
    [0, 0.045, 0.135, HERO_OUT],
    [1, 1, 0.76, 0.73]
  )

  const image1 = useTransform(
    scrollYProgress,
    [0, 0.04, 0.085, 0.155, 0.205],
    ["0vw", "24vw", "24vw", "24vw", "0vw"]
  )
  const image2 = useTransform(
    scrollYProgress,
    [0.02, 0.075, 0.12, 0.155, 0.205],
    ["0vw", "0vw", "24vw", "24vw", "0vw"]
  )
  const image3 = useTransform(
    scrollYProgress,
    [0.055, 0.11, 0.155, 0.175, 0.205],
    ["0vw", "0vw", "24vw", "24vw", "0vw"]
  )
  /* Arrives once the lockup has cleared its column and stays for the rest of the hero, rather
     than the 0.07-wide window it used to flash through. */
  const heroCopyOpacity = useTransform(
    scrollYProgress,
    [0.09, 0.155, HERO_HOLD + 0.075, HERO_OUT - 0.01],
    [0, 1, 1, 0]
  )
  const heroCopyY = useTransform(
    scrollYProgress,
    [0.09, 0.155, HERO_OUT - 0.01],
    [26, 0, -14]
  )

  const aboutOpacity = useTransform(
    scrollYProgress,
    [ABOUT_IN, ABOUT_IN + 0.06, ABOUT_OUT, ABOUT_OUT + 0.04],
    [0, 1, 1, 0]
  )
  const aboutY = useTransform(
    scrollYProgress,
    [ABOUT_IN, ABOUT_IN + 0.06, ABOUT_OUT, ABOUT_OUT + 0.04],
    ["4vh", "0vh", "0vh", "-4vh"]
  )
  const aboutHeadingX = useTransform(
    scrollYProgress,
    [ABOUT_IN + 0.01, ABOUT_IN + 0.08, ABOUT_OUT, ABOUT_OUT + 0.04],
    [-26, 0, 0, 14]
  )
  const aboutLedeY = useTransform(
    scrollYProgress,
    [ABOUT_IN + 0.03, ABOUT_IN + 0.1, ABOUT_OUT, ABOUT_OUT + 0.04],
    [24, 0, 0, -12]
  )
  const aboutLedeOpacity = useTransform(
    scrollYProgress,
    [ABOUT_IN + 0.03, ABOUT_IN + 0.1],
    [0, 1]
  )

  const workshopOpacity = useTransform(
    scrollYProgress,
    [KIDS_IN, KIDS_IN + 0.055, KIDS_OUT, KIDS_OUT + 0.04],
    [0, 1, 1, 0]
  )
  const workshopX = useTransform(
    scrollYProgress,
    [KIDS_IN, KIDS_IN + 0.055, KIDS_OUT, KIDS_OUT + 0.04],
    ["3vw", "0vw", "0vw", "-3vw"]
  )
  const workshopScale = useTransform(
    scrollYProgress,
    [KIDS_IN, KIDS_IN + 0.055, KIDS_OUT, KIDS_OUT + 0.04],
    [0.985, 1, 1, 0.99]
  )
  const workshopClip = useTransform(
    scrollYProgress,
    [KIDS_IN, KIDS_IN + 0.055, 1],
    ["inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  )
  const workshopCopyX = useTransform(
    scrollYProgress,
    [KIDS_IN + 0.015, KIDS_IN + 0.07, KIDS_OUT, KIDS_OUT + 0.035],
    [24, 0, 0, -18]
  )
  const workshopCopyOpacity = useTransform(
    scrollYProgress,
    [KIDS_IN + 0.015, KIDS_IN + 0.07, KIDS_OUT, KIDS_OUT + 0.035],
    [0, 1, 1, 0]
  )
  const workshopPortraitY = useTransform(
    scrollYProgress,
    [KIDS_IN + 0.015, KIDS_IN + 0.075, KIDS_OUT, KIDS_OUT + 0.035],
    [30, 0, 0, -18]
  )
  const workshopPortraitOpacity = useTransform(
    scrollYProgress,
    [KIDS_IN + 0.03, KIDS_IN + 0.09, KIDS_OUT, KIDS_OUT + 0.035],
    [0, 1, 1, 0]
  )
  const workshopFactsY = useTransform(
    scrollYProgress,
    [KIDS_IN + 0.045, KIDS_IN + 0.1, KIDS_OUT, KIDS_OUT + 0.035],
    [18, 0, 0, -12]
  )
  const workshopFactsOpacity = useTransform(
    scrollYProgress,
    [KIDS_IN + 0.07, KIDS_IN + 0.12, KIDS_OUT, KIDS_OUT + 0.03],
    [0, 1, 1, 0]
  )

  const adultsOpacity = useTransform(
    scrollYProgress,
    [ADULTS_IN, ADULTS_IN + 0.06, 1],
    [0, 1, 1]
  )
  const adultsY = useTransform(
    scrollYProgress,
    [ADULTS_IN, ADULTS_IN + 0.06, 1],
    ["6vh", "0vh", "0vh"]
  )
  const adultsImageClip = useTransform(
    scrollYProgress,
    [ADULTS_IN, ADULTS_IN + 0.06, 1],
    ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  )
  const adultsCopyX = useTransform(
    scrollYProgress,
    [ADULTS_IN + 0.025, ADULTS_IN + 0.08, 1],
    [30, 0, 0]
  )
  const adultsDetailX = useTransform(
    scrollYProgress,
    [ADULTS_IN + 0.025, ADULTS_IN + 0.08, 1],
    [-20, 0, 0]
  )
  const adultsDetailOpacity = useTransform(
    scrollYProgress,
    [ADULTS_IN + 0.035, ADULTS_IN + 0.09, 1],
    [0, 1, 1]
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
          style={{ x: ambientX, y: ambientY, backgroundColor: ambientColor }}
          aria-hidden="true"
        />

        <motion.article
          className={`kurzyScene kurzyHero${
            activeScene === 0 ? " is-active" : ""
          }`}
          style={{ opacity: heroOpacity, y: heroY, scale: heroScale }}
          aria-labelledby="kurzy-hero-title"
        >
          <SceneMeta
            left="Kurzy · Keramická zahrada"
            right="Písek · Malé skupiny"
          />

          <motion.div
            className="kurzyHero__title"
            style={{ x: heroTitleX, y: heroTitleY, scale: heroTitleScale }}
            aria-hidden="true"
          >
            <HeroTitleRow
              before="Ku"
              after="rzy"
              width={image1}
              src={images[0]}
              alt=""
              label="01 · Materiál"
            />
            <HeroTitleRow
              before="Kur"
              after="zy"
              width={image2}
              src={images[1]}
              alt=""
              label="02 · Vlastní tvar"
            />
            <HeroTitleRow
              before="Kurz"
              after="y"
              width={image3}
              src={images[2]}
              alt=""
              label="03 · Radost"
            />
          </motion.div>

          <motion.div
            className="kurzyHero__copy"
            style={{ opacity: heroCopyOpacity, y: heroCopyY }}
          >
            {/* Entrance on the children, not this element: its opacity and y are scroll-driven
                motion values, and those win over `animate` for the same property. */}
            <motion.span
              variants={heroReveal}
              initial="hidden"
              animate="show"
              custom={heroBeat.eyebrow}
            >
              Keramické kurzy · 01
            </motion.span>
            <motion.h1
              id="kurzy-hero-title"
              variants={heroReveal}
              initial="hidden"
              animate="show"
              custom={heroBeat.heading}
            >
              U hlíny se nedá spěchat.
              <em>A to je na tom to nejlepší.</em>
            </motion.h1>
            <motion.p
              variants={heroReveal}
              initial="hidden"
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
            initial="hidden"
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
          style={{ opacity: aboutOpacity, y: aboutY }}
          aria-labelledby="kurzy-about-title"
        >
          <SceneMeta left="02 · O kurzech" right="Pro děti i dospělé" />

          <motion.header
            className="kurzyAbout__intro"
            style={{ x: aboutHeadingX }}
          >
            <span>Jak to na kurzu vypadá</span>
            <h2 id="kurzy-about-title">
              Nejdřív hlína.
              <em>Potom nápad.</em>
            </h2>
          </motion.header>

          <motion.div
            className="kurzyAbout__lede"
            style={{ y: aboutLedeY, opacity: aboutLedeOpacity }}
          >
            <p>{data?.content || fallbackAbout}</p>
          </motion.div>

          <div className="kurzyAbout__steps">
            {courseSteps.map((step, index) => (
              <CourseStep
                key={step.number}
                step={step}
                progress={scrollYProgress}
                index={index}
              />
            ))}
          </div>
        </motion.section>

        <motion.article
          className={`kurzyScene kurzyWorkshop${
            activeScene === 2 ? " is-active" : ""
          }`}
          style={{
            opacity: workshopOpacity,
            x: workshopX,
            scale: workshopScale,
          }}
          aria-labelledby="kurzy-workshop-title"
        >
          <SceneMeta
            left="03 · Kurzy pro děti"
            right="Rukama · Pomalu · Společně"
          />

          <motion.figure
            className="kurzyWorkshop__landscape"
            style={{ clipPath: workshopClip }}
          >
            <Image
              src="/assets/img/roller/1h.jpg"
              alt="Děti poznávají keramiku prostřednictvím práce rukama"
              fill
              sizes="64vw"
            />
            <figcaption>
              <span>Ateliér · Písek</span>
              <i />
              <span>Každý výsledek je originál</span>
            </figcaption>
          </motion.figure>

          <motion.figure
            className="kurzyWorkshop__portrait"
            style={{ opacity: workshopPortraitOpacity, y: workshopPortraitY }}
          >
            <Image
              src="/assets/img/roller/1v.jpg"
              alt="Detail ručně vytvořeného keramického výrobku"
              fill
              sizes="20vw"
            />
          </motion.figure>

          <motion.div
            className="kurzyWorkshop__copy"
            style={{ opacity: workshopCopyOpacity, x: workshopCopyX }}
          >
            <span>Klid · Soustředění · Radost</span>
            <h2 id="kurzy-workshop-title">
              Práce rukama
              <em>děti baví.</em>
            </h2>
            <p>
              U hlíny se dítě samo zklidní, zapojí fantazii a má radost z toho,
              co mu vzniklo pod rukama. Nikomu nic nepředepisuju — každý si
              najde svůj způsob.
            </p>
            <div className="kurzyWorkshop__action">
              <ContactTrigger
                text="Kurz pro školu"
                topic="Kurzy"
                className="kurzyTimelineCtaButton"
              />
              <span>
                Pro školy i kroužky — program a délku přizpůsobím věku skupiny.
              </span>
            </div>
          </motion.div>

          <motion.dl
            className="kurzyWorkshop__facts"
            style={{ opacity: workshopFactsOpacity, y: workshopFactsY }}
          >
            <div>
              <dt>Pro koho</dt>
              <dd>Děti a malé skupiny</dd>
            </div>
            <div>
              <dt>Školy a kroužky</dt>
              <dd>Po domluvě</dd>
            </div>
            <div>
              <dt>Od hlíny po</dt>
              <dd>Glazování a výpal</dd>
            </div>
          </motion.dl>
        </motion.article>

        <motion.article
          className={`kurzyScene kurzyTimelineAdults${
            activeScene === 3 ? " is-active" : ""
          }`}
          style={{ opacity: adultsOpacity, y: adultsY }}
          aria-labelledby="kurzy-adults-title"
        >
          <SceneMeta left="04 · Kurzy pro dospělé" right="Připravujeme" />

          <motion.figure
            className="kurzyTimelineAdults__image"
            style={{ clipPath: adultsImageClip }}
          >
            <Image
              src="/assets/img/roller/2v.jpg"
              alt="Keramický detail v zahradě"
              fill
              sizes="34vw"
            />
            <figcaption>Ateliér · Písek</figcaption>
          </motion.figure>

          <motion.figure
            className="kurzyTimelineAdults__detail"
            style={{ opacity: adultsDetailOpacity, x: adultsDetailX }}
            aria-hidden="true"
          >
            <Image src="/assets/img/roller/4h.jpg" alt="" fill sizes="22vw" />
          </motion.figure>

          <motion.div
            className="kurzyTimelineAdults__copy"
            style={{ x: adultsCopyX }}
          >
            <span>Zase si něco udělat rukama</span>
            <h2 id="kurzy-adults-title">
              Chystám kurzy
              <em>i pro dospělé.</em>
            </h2>
            <p>
              Malá skupina, pár klidných hodin u hlíny a výrobek, který
              si odnesete domů. Dejte vědět, ať vám můžu napsat, až budu mít
              termíny.
            </p>
            <ContactTrigger
              text="Dejte mi vědět"
              topic="Kurzy"
              className="kurzyTimelineCtaButton"
            />
          </motion.div>

          <p className="kurzyTimelineAdults__aside">
            Malé skupiny
            <span>Osobní vedení</span>
            <span>Ateliér u Písku</span>
          </p>
        </motion.article>

        <footer
          className={`kurzyTimeline__rail kurzyTimeline__rail--${
            activeScene + 1
          }`}
        >
          <span>01 · Kurzy</span>
          <span>02 · O kurzech</span>
          <span>03 · Děti</span>
          <span>04 · Dospělí</span>
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
  width: MotionValue<string>
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

function CourseStep({
  step,
  progress,
  index,
}: {
  step: (typeof courseSteps)[number]
  progress: MotionValue<number>
  index: number
}) {
  /* All three are on screen together now, so the only per-step value is when it arrives: a beat
     apart, left to right, inside the scene's own entrance. */
  const start = ABOUT_IN + 0.015 + index * 0.025
  const settled = start + 0.055

  const opacity = useTransform(
    progress,
    [start, settled, ABOUT_OUT, ABOUT_OUT + 0.035],
    [0, 1, 1, 0]
  )
  const y = useTransform(
    progress,
    [start, settled, ABOUT_OUT, ABOUT_OUT + 0.035],
    [30, 0, 0, -14]
  )
  const clip = useTransform(
    progress,
    [start, settled, 1],
    ["inset(0% 0% 100% 0%)", "inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  )

  return (
    <motion.article className="kurzyStep" style={{ opacity, y }}>
      <motion.figure style={{ clipPath: clip }}>
        <Image src={step.src} alt={step.alt} fill sizes="30vw" />
      </motion.figure>
      {/* No "of 03" counter: all three are on screen at once, so the total is already visible. */}
      <div className="kurzyStep__number">
        <span>{step.number}</span>
        <i />
      </div>
      <span className="kurzyStep__eyebrow">{step.eyebrow}</span>
      <h3>
        {step.title}
        <em>{step.accent}</em>
      </h3>
      <p>{step.text}</p>
    </motion.article>
  )
}
