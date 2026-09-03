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
import { galleryUrl, type CopyBlock, type CopyImage } from "@lib/util/site-copy"
import { editable } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import ContactTrigger from "@modules/layout/ContactDialog/trigger"
import WebButton from "@modules/common/components/Buttons/webButton"
import { alpha, palette } from "styles/palette.generated"

/** Blok `kurzy.intro` z CMS. Jméno zůstává, importuje ho wrapper i stránka. */
export type KurzyIntroData = CopyBlock | undefined

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

/*
 * One photograph per audience, above the block it belongs to.
 *
 * Placeholders from the existing library for now — the `image`/`alt` pair is what the three
 * blocks are keyed on, so swapping in the real shoot later is a change to these three lines and
 * nothing else.
 */
const audienceBlocks = [
  {
    number: "01",
    image: "/assets/img/img/4.jpg",
    imageAlt: "Dětské ruce u hrnčířské hlíny",
    eyebrow: "Školy · Školky · Kroužky",
    title: "Pro děti",
    accent: "a školy.",
    text: "Program a délku přizpůsobím věku skupiny. U hlíny se děti samy zklidní a odnesou si vlastní výrobek.",
    action: "contact" as const,
    cta: "Napište mi",
  },
  {
    number: "02",
    image: "/assets/img/img/9.jpg",
    imageAlt: "Skupina u společného tvoření v ateliéru",
    eyebrow: "Teambuilding · Společné tvoření",
    title: "Pro firmy",
    accent: "a spolky.",
    text: "Pár klidných hodin u hlíny místo porady. Termín a náplň domluvíme podle vaší skupiny.",
    action: "contact" as const,
    cta: "Napište mi",
  },
  {
    number: "03",
    image: "/assets/img/img/2.jpg",
    imageAlt: "Hotový keramický kus z kurzu",
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
  block,
  gallery,
  about,
  onReserveAction,
}: {
  block?: KurzyIntroData
  /**
   * Blok `kurzy.galerie` — tři fotky u typů kurzů.
   *
   * Vlastní blok, ne další fotky v `kurzy.intro`: úvod stránky si své tři
   * bere z galerie toho bloku a míchat obojí do jednoho pole by znamenalo,
   * že se editor musí trefovat do indexů 3–5 a vědět proč.
   */
  gallery?: CopyBlock
  /** Blok `kurzy.about` — scéna „Pro koho": nadpisy, popisek a tři bloky publik. */
  about?: CopyBlock
  /** „Pro zájemce → Vybrat termín" — opens the reservation modal. */
  onReserveAction: () => void
}) {
  /* Scény jedou jen ze scrollu — bez tohohle by po zapnutí editace zůstaly
     anotace prázdné. Viz hook. */
  useEditRerender()

  const railLeft = block?.accent?.[0]?.trim() || "Kurzy · Keramická zahrada"
  const railRight = block?.accent?.[1]?.trim() || "Písek · Malé skupiny"
  const heroEyebrow = block?.accent?.[2]?.trim() || "Keramické kurzy · 01"
  const scrollCue = block?.accent?.[3]?.trim() || "Pojďte dál"
  const progressFirst = block?.accent?.[4]?.trim() || "01 · Kurzy"
  const heroTitle = block?.title?.trim() || "U hlíny se nedá spěchat."
  const heroAccent = block?.headline?.trim() || "A to je na tom to nejlepší."
  const heroLede = block?.bodyText?.trim() || fallbackLede
  /* Popisky u fotek v řádcích nadpisu — řádky `items`; samotné slovo „Kurzy"
     je značka stránky a zůstává v kódu. */
  const rowLabels = [
    block?.items?.[0]?.label?.trim() || "01 · Materiál",
    block?.items?.[1]?.label?.trim() || "02 · Vlastní tvar",
    block?.items?.[2]?.label?.trim() || "03 · Radost",
  ]

  const aboutMetaLeft = about?.accent?.[0]?.trim() || "02 · Pro koho"
  const aboutMetaRight = about?.accent?.[1]?.trim() || "Děti · Firmy · Zájemci"
  const aboutEyebrow = about?.accent?.[2]?.trim() || "Kurzy pro každého"
  const ctaContact = about?.accent?.[3]?.trim() || "Napište mi"
  const ctaReserve = about?.accent?.[4]?.trim() || "Vybrat termín"
  const aboutLead = about?.title?.trim() || "Nejdřív hlína."
  const aboutAccentText = about?.headline?.trim() || "Potom nápad."
  const aboutText = about?.bodyText?.trim() || fallbackAbout

  /* Tři publika: texty z řádků `kurzy.about`, fotky z `kurzy.galerie`. */
  const audiences = audienceBlocks.map((item, index) => {
    const row = about?.items?.[index]
    return {
      ...item,
      eyebrow: row?.lead?.trim() || item.eyebrow,
      title: row?.label?.trim() || item.title,
      text: row?.value?.trim() || item.text,
      accent: row?.note?.trim() || item.accent,
      cta: item.action === "contact" ? ctaContact : ctaReserve,
      cmsIndex: index,
    }
  })

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
    [palette.kurzyInk, palette.kurzyInk, palette.cream05, palette.cream05]
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
      alpha("kurzyAccent", .2),
      alpha("kurzyAccent", .12),
      alpha("ambientShowcase1", .78),
      alpha("ambientShowcase1", .32),
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
  /*
   * The last four scroll coordinates in this file that were still bare pixels, while the eight
   * around them (heroTitleX/Y, image1–3, aboutY) were already written as vw/vh.
   *
   * Read at the 900px-tall / 1440px-wide window the numbers were authored on, so `k = 1` there
   * and nothing moves on the reference screen: 26/900 = 2.89vh, 14/900 = 1.56vh, 24/900 = 2.67vh,
   * 30/900 = 3.33vh, and the one horizontal nudge 26/1440 = 1.8vw. In px a 26px entrance was the
   * same physical nudge on a 660px laptop and a 1351px desktop; as a percentage of the window it
   * is the same GESTURE on both. Every keyframe of a value carries the same unit — a mixed pair
   * stops being interpolatable and framer jumps instead of tweening.
   */
  const heroCopyY = useTransform(
    scrollYProgress,
    [0.165, 0.29, HERO_OUT - 0.02],
    ["2.89vh", "0vh", "-1.56vh"]
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
  /* Sideways, so vw — the heading slides in along its own column, not against the screen height. */
  const aboutHeadingX = useTransform(
    scrollYProgress,
    [ABOUT_IN + 0.02, ABOUT_IN + 0.15, 1],
    ["-1.8vw", "0vw", "0vw"]
  )
  const aboutLedeY = useTransform(
    scrollYProgress,
    [ABOUT_IN + 0.055, ABOUT_IN + 0.185, 1],
    ["2.67vh", "0vh", "0vh"]
  )
  const aboutLedeOpacity = useTransform(
    scrollYProgress,
    [ABOUT_IN + 0.055, ABOUT_IN + 0.185],
    [0, 1]
  )

  const progressScale = useTransform(scrollYProgress, [0, 1], [0.03, 1])

  // Z CMS chodí hotové adresy v úložišti — žádný builder jako u Sanity.
  // `galleryUrl` drží zálohu pro případ, že blok fotku nemá.
  const images = [
    galleryUrl(block, 0, "/assets/img/img/2.jpg"),
    galleryUrl(block, 1, "/assets/img/img/3.jpg"),
    galleryUrl(block, 2, "/assets/img/img/5.jpg"),
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
            left={railLeft}
            right={railRight}
            editLeft={editable(block, "accent.0")}
            editRight={editable(block, "accent.1")}
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
            {/* Slovo „Kurzy" je značka stránky a jeho řezy drží typografii — v kódu.
                Popisky a fotky mezi písmeny jdou z CMS. */}
            <HeroTitleRow
              before="Ku"
              after="rzy"
              width={reduceMotion ? "24vw" : image1}
              src={images[0]}
              alt=""
              label={rowLabels[0]}
              editLabel={editable(block, "items.0.label")}
              editImage={editable(block, "gallery.0", "image")}
            />
            <HeroTitleRow
              before="Kur"
              after="zy"
              width={reduceMotion ? "24vw" : image2}
              src={images[1]}
              alt=""
              label={rowLabels[1]}
              editLabel={editable(block, "items.1.label")}
              editImage={editable(block, "gallery.1", "image")}
            />
            <HeroTitleRow
              before="Kurz"
              after="y"
              width={reduceMotion ? "24vw" : image3}
              src={images[2]}
              alt=""
              label={rowLabels[2]}
              editLabel={editable(block, "items.2.label")}
              editImage={editable(block, "gallery.2", "image")}
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
              <span {...editable(block, "accent.2")}>{heroEyebrow}</span>
            </motion.span>
            <motion.h1
              id="kurzy-hero-title"
              variants={heroReveal}
              initial={reduceMotion ? false : "hidden"}
              animate="show"
              custom={heroBeat.heading}
            >
              <span {...editable(block, "title")}>{heroTitle}</span>
              <em {...editable(block, "headline")}>{heroAccent}</em>
            </motion.h1>
            <motion.p
              variants={heroReveal}
              initial={reduceMotion ? false : "hidden"}
              animate="show"
              custom={heroBeat.lede}
              {...editable(block, "body")}
            >
              {heroLede}
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
            <span {...editable(block, "accent.3")}>{scrollCue}</span>
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
          <SceneMeta
            left={aboutMetaLeft}
            right={aboutMetaRight}
            editLeft={editable(about, "accent.0")}
            editRight={editable(about, "accent.1")}
          />

          <motion.header
            className="kurzyAbout__intro"
            style={reduceMotion ? undefined : { x: aboutHeadingX }}
          >
            <span {...editable(about, "accent.2")}>{aboutEyebrow}</span>
            {/* Obě půlky vlastní pole — `editable` píše celé pole naráz. */}
            <h2 id="kurzy-about-title">
              <span {...editable(about, "title")}>{aboutLead}</span>
              <em {...editable(about, "headline")}>{aboutAccentText}</em>
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
            <p {...editable(about, "body")}>{aboutText}</p>
          </motion.div>

          <div className="kurzyAbout__blocks">
            {audiences.map((audience, index) => (
              <AudienceBlock
                key={audience.number}
                block={audience}
                photo={gallery?.gallery?.[index]}
                edit={editable(gallery, `gallery.${index}`, "image")}
                editTexts={{
                  eyebrow: editable(about, `items.${index}.lead`),
                  title: editable(about, `items.${index}.label`),
                  accent: editable(about, `items.${index}.note`),
                  text: editable(about, `items.${index}.value`),
                  cta: editable(
                    about,
                    audience.action === "contact" ? "accent.3" : "accent.4"
                  ),
                }}
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
          <span {...editable(block, "accent.4")}>{progressFirst}</span>
          {/* Totéž slovo jako v hlavičce scény — jedno pole, dvě místa. */}
          <span {...editable(about, "accent.0")}>{aboutMetaLeft}</span>
          <i>
            <motion.b style={{ scaleX: progressScale }} />
          </i>
        </footer>
      </motion.div>
    </section>
  )
}

function SceneMeta({
  left,
  right,
  editLeft,
  editRight,
}: {
  left: string
  right: string
  /** Atributy překryvu pro obě půlky lišty. Mimo náhled prázdné. */
  editLeft?: Record<string, string | undefined>
  editRight?: Record<string, string | undefined>
}) {
  return (
    <header className="kurzySceneMeta">
      <span {...editLeft}>{left}</span>
      <i />
      <span {...editRight}>{right}</span>
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
  editLabel,
  editImage,
}: {
  before: string
  after: string
  /** A scroll-driven motion value, or a fixed width under reduced motion. */
  width: MotionValue<string> | string
  src: string
  alt: string
  label: string
  /** Atributy překryvu pro popisek a fotku řádku. Mimo náhled prázdné. */
  editLabel?: Record<string, string | undefined>
  editImage?: Record<string, string | undefined>
}) {
  return (
    <div className="kurzyHero__titleRow">
      <span>{before}</span>
      <motion.figure style={{ width }} {...editImage}>
        <Image src={src} alt={alt} fill sizes="24vw" priority />
        <figcaption {...editLabel}>{label}</figcaption>
      </motion.figure>
      <span>{after}</span>
    </div>
  )
}

function AudienceBlock({
  block,
  photo,
  edit,
  editTexts,
  progress,
  index,
  onReserve,
}: {
  block: (typeof audienceBlocks)[number]
  /** Fotka z CMS; chybí-li, kreslí se ta z `block`. */
  photo?: CopyImage
  /** Atributy překryvu. Mimo náhled prázdný objekt. */
  edit?: Record<string, string | undefined>
  /** Atributy překryvu pro texty bloku (řádek `kurzy.about`). */
  editTexts?: {
    eyebrow?: Record<string, string | undefined>
    title?: Record<string, string | undefined>
    accent?: Record<string, string | undefined>
    text?: Record<string, string | undefined>
    cta?: Record<string, string | undefined>
  }
  progress: MotionValue<number>
  index: number
  onReserve: () => void
}) {
  /* All three arrive a beat apart, left to right, inside the scene's entrance. */
  const reduceMotion = useReducedMotion()
  const start = ABOUT_IN + 0.03 + index * 0.045
  const settled = start + 0.1

  const opacity = useTransform(progress, [start, settled, 1], [0, 1, 1])
  /* vh for the same reason as the scene's own entrance above: 30/900 on the reference window. */
  const y = useTransform(progress, [start, settled, 1], ["3.33vh", "0vh", "0vh"])

  return (
    <motion.article
      className="kurzyAudience"
      style={reduceMotion ? { opacity } : { opacity, y }}
    >
      {/* Above the rule, so the number still reads as the start of the block's text. */}
      <div className="kurzyAudience__figure" {...edit}>
        <Image
          src={photo?.url ?? block.image}
          alt={photo?.alt?.trim() || block.imageAlt}
          fill
          sizes="(max-width: 900px) 100vw, 30vw"
        />
      </div>

      <div className="kurzyAudience__number">
        <span>{block.number}</span>
        <i />
      </div>
      <span className="kurzyAudience__eyebrow" {...editTexts?.eyebrow}>
        {block.eyebrow}
      </span>
      <h3>
        <span {...editTexts?.title}>{block.title}</span>
        <em {...editTexts?.accent}>{block.accent}</em>
      </h3>
      <p {...editTexts?.text}>{block.text}</p>
      <div className="kurzyAudience__action">
        {/* Obal, ne tlačítko: obě si vykreslují vlastní vnitřek a datové atributy
            by skončily na prvku, který se při animaci přepisuje. */}
        {block.action === "contact" ? (
          <span {...editTexts?.cta}>
            <ContactTrigger
              text={block.cta}
              topic="Kurzy"
              className="kurzyTimelineCtaButton"
            />
          </span>
        ) : (
          <span {...editTexts?.cta}>
            <WebButton
              Kind="Button"
              title={block.cta}
              className="kurzyTimelineCtaButton"
              onClickAction={onReserve}
            />
          </span>
        )}
      </div>
    </motion.article>
  )
}
