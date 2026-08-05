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
import Image from "next/image"
import { useRef, useState } from "react"
import type { SanityImageSource } from "@sanity/image-url/lib/types/types"
import { urlFor } from "../../../../sanity/lib/image"
import ContactTrigger from "@modules/layout/ContactDialog/trigger"

export type KurzyIntroData = {
  content?: string
  images?: SanityImageSource[]
} | null

const fallbackCopy =
  "V keramických kurzech děti poznávají hlínu pomalu a bez spěchu. Od prvního doteku přes vlastní tvar až po glazování vzniká nejen originální objekt, ale také radost z práce rukama."

const workshopMoments = [
  {
    number: "01",
    eyebrow: "První setkání",
    title: "Poznat materiál",
    accent: "dotekem.",
    text: "Děti objevují, jak hlína reaguje na tlak, vodu, nástroje i trpělivost.",
    src: "/assets/img/roller/2h.jpg",
    alt: "Keramický detail vzniklý ruční prací",
    range: [0.485, 0.525, 0.59, 0.63] as [number, number, number, number],
  },
  {
    number: "02",
    eyebrow: "Vlastní rukopis",
    title: "Najít vlastní tvar",
    accent: "bez předlohy.",
    text: "Každý objekt si uchová vlastní stopu, drobnou nedokonalost a osobní charakter.",
    src: "/assets/img/roller/3v.jpg",
    alt: "Ručně modelovaný keramický objekt",
    range: [0.59, 0.625, 0.69, 0.73] as [number, number, number, number],
  },
  {
    number: "03",
    eyebrow: "Po výpalu",
    title: "Odnést si radost",
    accent: "domů.",
    text: "Nápad se po glazování vrací jako skutečný předmět pro domov nebo zahradu.",
    src: "/assets/img/roller/4h.jpg",
    alt: "Hotový keramický objekt v zahradě",
    range: [0.69, 0.725, 0.79, 0.835] as [number, number, number, number],
  },
]

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
      progress < 0.27 ? 0 : progress < 0.47 ? 1 : progress < 0.8 ? 2 : 3
    setActiveScene((current) => (current === scene ? current : scene))
  })

  const background = useTransform(
    scrollYProgress,
    [0, 0.245, 0.31, 0.445, 0.51, 0.775, 0.84, 1],
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

  const heroOpacity = useTransform(scrollYProgress, [0, 0.24, 0.3], [1, 1, 0])
  const heroY = useTransform(
    scrollYProgress,
    [0, 0.24, 0.3],
    ["0vh", "0vh", "-6vh"]
  )
  const heroScale = useTransform(scrollYProgress, [0, 0.24, 0.3], [1, 1, 0.97])
  const heroTitleX = useTransform(
    scrollYProgress,
    [0, 0.16, 0.195, 0.25, 0.3],
    ["0vw", "0vw", "-16vw", "-16vw", "-18vw"]
  )
  const heroTitleY = useTransform(
    scrollYProgress,
    [0, 0.16, 0.195, 0.25, 0.3],
    ["0vh", "0vh", "0vh", "0vh", "-4vh"]
  )
  const heroTitleScale = useTransform(
    scrollYProgress,
    [0, 0.16, 0.195, 0.25, 0.3],
    [1, 1, 0.75, 0.75, 0.72]
  )

  const image1 = useTransform(
    scrollYProgress,
    [0, 0.045, 0.095, 0.245, 0.295],
    ["0vw", "24vw", "24vw", "24vw", "0vw"]
  )
  const image2 = useTransform(
    scrollYProgress,
    [0.025, 0.085, 0.135, 0.245, 0.295],
    ["0vw", "0vw", "24vw", "24vw", "0vw"]
  )
  const image3 = useTransform(
    scrollYProgress,
    [0.065, 0.125, 0.175, 0.245, 0.295],
    ["0vw", "0vw", "24vw", "24vw", "0vw"]
  )
  const heroCopyOpacity = useTransform(
    scrollYProgress,
    [0.185, 0.215, 0.255, 0.295],
    [0, 1, 1, 0]
  )
  const heroCopyY = useTransform(
    scrollYProgress,
    [0.185, 0.215, 0.255, 0.295],
    [24, 0, 0, -16]
  )
  const heroCopyX = useTransform(
    scrollYProgress,
    [0.185, 0.215, 0.255, 0.295],
    ["2vw", "0vw", "0vw", "3vw"]
  )

  const workshopOpacity = useTransform(
    scrollYProgress,
    [0.235, 0.3, 0.445, 0.495],
    [0, 1, 1, 0]
  )
  const workshopX = useTransform(
    scrollYProgress,
    [0.235, 0.3, 0.445, 0.495],
    ["3vw", "0vw", "0vw", "-3vw"]
  )
  const workshopScale = useTransform(
    scrollYProgress,
    [0.235, 0.3, 0.445, 0.495],
    [0.985, 1, 1, 0.99]
  )
  const workshopClip = useTransform(
    scrollYProgress,
    [0.235, 0.3, 1],
    ["inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  )
  const workshopCopyX = useTransform(
    scrollYProgress,
    [0.255, 0.305, 0.445, 0.49],
    [24, 0, 0, -18]
  )
  const workshopCopyOpacity = useTransform(
    scrollYProgress,
    [0.255, 0.305, 0.445, 0.49],
    [0, 1, 1, 0]
  )
  const workshopPortraitY = useTransform(
    scrollYProgress,
    [0.255, 0.31, 0.445, 0.49],
    [30, 0, 0, -18]
  )
  const workshopPortraitOpacity = useTransform(
    scrollYProgress,
    [0.27, 0.325, 0.45, 0.49],
    [0, 1, 1, 0]
  )
  const workshopFactsY = useTransform(
    scrollYProgress,
    [0.285, 0.335, 0.445, 0.49],
    [18, 0, 0, -12]
  )
  const workshopFactsOpacity = useTransform(
    scrollYProgress,
    [0.31, 0.36, 0.445, 0.485],
    [0, 1, 1, 0]
  )

  const momentsOpacity = useTransform(
    scrollYProgress,
    [0.435, 0.495, 0.79, 0.84],
    [0, 1, 1, 0]
  )
  const momentsY = useTransform(
    scrollYProgress,
    [0.435, 0.495, 0.79, 0.84],
    ["5vh", "0vh", "0vh", "-5vh"]
  )

  const adultsOpacity = useTransform(
    scrollYProgress,
    [0.775, 0.835, 1],
    [0, 1, 1]
  )
  const adultsY = useTransform(
    scrollYProgress,
    [0.775, 0.835, 1],
    ["6vh", "0vh", "0vh"]
  )
  const adultsImageClip = useTransform(
    scrollYProgress,
    [0.775, 0.835, 1],
    ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  )
  const adultsCopyX = useTransform(scrollYProgress, [0.8, 0.855, 1], [30, 0, 0])
  const adultsDetailX = useTransform(
    scrollYProgress,
    [0.8, 0.855, 1],
    [-20, 0, 0]
  )
  const adultsDetailOpacity = useTransform(
    scrollYProgress,
    [0.81, 0.865, 1],
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
            style={{ opacity: heroCopyOpacity, x: heroCopyX, y: heroCopyY }}
          >
            <span>Ateliér otevřený tvoření · 01</span>
            <h1 id="kurzy-hero-title">
              Hlína zpomalí čas.
              <em>Ruce najdou vlastní rytmus.</em>
            </h1>
            <p>{data?.content || fallbackCopy}</p>
          </motion.div>

          <div className="kurzyHero__scrollCue" aria-hidden="true">
            <MouseAnim />
            <span>Vstoupit do ateliéru</span>
          </div>
        </motion.article>

        <motion.article
          className={`kurzyScene kurzyWorkshop${
            activeScene === 1 ? " is-active" : ""
          }`}
          style={{
            opacity: workshopOpacity,
            x: workshopX,
            scale: workshopScale,
          }}
          aria-labelledby="kurzy-workshop-title"
        >
          <SceneMeta
            left="01 · Kurzy pro děti"
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
              alt="Detail ručně vytvořeného keramického objektu"
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
              Tvoření, které učí
              <em>dívat se rukama.</em>
            </h2>
            <p>
              Práce s hlínou se přirozeně propojuje se soustředěním, fantazií a
              radostí z vlastního výsledku. Každému dítěti necháváme prostor
              najít svůj způsob tvorby.
            </p>
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
              <dt>Přístup</dt>
              <dd>Individuální vedení</dd>
            </div>
            <div>
              <dt>Od hlíny po</dt>
              <dd>Glazování a výpal</dd>
            </div>
          </motion.dl>
        </motion.article>

        <motion.section
          className={`kurzyScene kurzyTimelineMoments${
            activeScene === 2 ? " is-active" : ""
          }`}
          style={{ opacity: momentsOpacity, y: momentsY }}
          aria-labelledby="kurzy-moments-title"
        >
          <SceneMeta left="02 · Co děti zažijí" right="Tři tiché momenty" />

          <header className="kurzyTimelineMoments__intro">
            <span>Od prvního doteku k hotovému objektu</span>
            <h2 id="kurzy-moments-title">
              Nejdřív materiál.
              <em>Potom vlastní příběh.</em>
            </h2>
          </header>

          <div className="kurzyTimelineMoments__chapters">
            {workshopMoments.map((moment, index) => (
              <MomentChapter
                key={moment.number}
                moment={moment}
                progress={scrollYProgress}
                index={index}
              />
            ))}
          </div>
        </motion.section>

        <motion.article
          className={`kurzyScene kurzyTimelineAdults${
            activeScene === 3 ? " is-active" : ""
          }`}
          style={{ opacity: adultsOpacity, y: adultsY }}
          aria-labelledby="kurzy-adults-title"
        >
          <SceneMeta left="03 · Kurzy pro dospělé" right="Připravujeme" />

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
            <figcaption>Prostor pro zpomalení · Písek</figcaption>
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
            <span>Vrátit se k práci rukama</span>
            <h2 id="kurzy-adults-title">
              Místo pro klid.
              <em>A vlastní tvar.</em>
            </h2>
            <p>
              Připravujeme komorní kurzy pro dospělé: čas pro soustředění,
              řemeslnou práci a radost z objektu, který vznikne jen jednou.
            </p>
            <ContactTrigger
              text="Chci vědět o kurzech"
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
          <span>02 · Ateliér</span>
          <span>03 · Proces</span>
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

function MomentChapter({
  moment,
  progress,
  index,
}: {
  moment: (typeof workshopMoments)[number]
  progress: MotionValue<number>
  index: number
}) {
  const [start, reveal, hold, end] = moment.range
  const opacity = useTransform(
    progress,
    [start, reveal, hold, end],
    [0, 1, 1, 0]
  )
  const imageClip = useTransform(
    progress,
    [start, reveal, end],
    ["inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  )
  const imageScale = useTransform(
    progress,
    [start, reveal, hold, end],
    [1.025, 1, 1, 0.99]
  )
  const copyX = useTransform(
    progress,
    [start, reveal, hold, end],
    [index % 2 === 0 ? 24 : -24, 0, 0, index % 2 === 0 ? -16 : 16]
  )
  const copyY = useTransform(
    progress,
    [start, reveal, hold, end],
    [12, 0, 0, -10]
  )

  return (
    <motion.article
      className={`kurzyMoment kurzyMoment--${index + 1}`}
      style={{ opacity }}
    >
      <motion.figure style={{ clipPath: imageClip }}>
        <motion.div style={{ scale: imageScale }}>
          <Image src={moment.src} alt={moment.alt} fill sizes="48vw" />
        </motion.div>
        <figcaption>
          <span>{moment.number} · Ateliér</span>
          <i />
          <span>Keramická zahrada</span>
        </figcaption>
      </motion.figure>

      <motion.div className="kurzyMoment__copy" style={{ x: copyX, y: copyY }}>
        <div className="kurzyMoment__number">
          <span>{moment.number}</span>
          <i />
          <span>03</span>
        </div>
        <span>{moment.eyebrow}</span>
        <h3>
          {moment.title}
          <em>{moment.accent}</em>
        </h3>
        <p>{moment.text}</p>
      </motion.div>
    </motion.article>
  )
}
