"use client"

import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import Image from "next/image"
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion"
import { useRef, useState } from "react"

/**
 * The two chapters of the old AboutInfo section, word for word — only the inline icons are
 * gone and the copy is recut into the process page's lead/accent/body rhythm. The visual
 * grammar is the vyroba gallery's: a sticky stage, images wiping in from below, copy
 * cross-fading beside them, numbered progress underneath.
 */
const storySteps = [
  {
    number: "01",
    title: "Kořeny",
    label: "Písek · Bechyně",
    lead: "Jsem",
    accent: "písecká rodačka.",
    text: "Absolventka SPŠ keramické v Bechyni a máma dvou úžasných dětí. Naplno se keramice věnuji od roku 2014.",
    src: "/assets/img/ome/3.png",
    alt: "Lucie při ruční výrobě keramiky",
  },
  {
    number: "02",
    title: "Rukopis",
    label: "Poetika · Materiál",
    lead: "Svou originální poetikou",
    accent: "a přírodním designem,",
    text: "i volbou vysoce kvalitních materiálů má keramika osloví každého, kdo hledá výtvarnou i řemeslnou kvalitu.",
    src: "/assets/img/ome/4.png",
    alt: "Keramika Lucie Polanské",
  },
]

type StoryStep = (typeof storySteps)[number]

function ImageLayer({
  item,
  index,
  progress,
}: {
  item: StoryStep
  index: number
  progress: MotionValue<number>
}) {
  const count = storySteps.length
  const segment = 1 / count
  const boundary = index * segment
  const revealStart = Math.max(0, boundary - segment * 0.26)
  const revealEnd = Math.min(1, boundary + segment * 0.16)

  const clipPath = useTransform(
    progress,
    index === 0 ? [0, 1] : [revealStart, revealEnd],
    index === 0
      ? ["inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
      : ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  )
  const imageY = useTransform(
    progress,
    [revealStart, Math.min(1, revealEnd + segment * 0.7)],
    ["2.8%", "-1.2%"]
  )
  const imageScale = useTransform(
    progress,
    [revealStart, revealEnd],
    [1.045, 1]
  )

  return (
    <motion.figure
      className="aboutStory__image"
      style={{ clipPath, zIndex: index + 1 }}
    >
      <motion.div
        className="aboutStory__imageInner"
        style={{ y: imageY, scale: imageScale }}
      >
        <Image
          src={item.src}
          alt={item.alt}
          fill
          sizes="(max-width: 760px) 100vw, 58vw"
        />
      </motion.div>
      <div className="aboutStory__imageShade" aria-hidden="true" />
      <figcaption>
        <span>
          {item.number} · {item.label}
        </span>
        <i />
        <span>Ateliér · Písek</span>
      </figcaption>
    </motion.figure>
  )
}

function CopyLayer({
  item,
  index,
  progress,
  isActive,
}: {
  item: StoryStep
  index: number
  progress: MotionValue<number>
  isActive: boolean
}) {
  const count = storySteps.length
  const segment = 1 / count
  const start = index * segment
  const end = (index + 1) * segment

  const opacity = useTransform(
    progress,
    index === 0
      ? [0, end - segment * 0.22, end]
      : [start - segment * 0.24, start + segment * 0.14, 1],
    index === 0 ? [1, 1, 0] : [0, 1, 1]
  )
  const y = useTransform(
    progress,
    [
      Math.max(0, start - segment * 0.2),
      start + segment * 0.16,
      Math.min(1, end),
    ],
    [18, 0, -12]
  )

  return (
    <motion.article
      className="aboutStory__copy"
      style={{ opacity, y }}
      aria-hidden={!isActive}
    >
      <div className="aboutStory__index">
        <span>{item.number}</span>
        <i />
        <span>0{storySteps.length}</span>
      </div>

      <p className="aboutStory__label">{item.label}</p>
      <h2>{item.title}</h2>

      <p className="aboutStory__lead">
        {item.lead} <em>{item.accent}</em>
      </p>
      <p className="aboutStory__body">{item.text}</p>
    </motion.article>
  )
}

function ProgressStep({
  item,
  index,
  progress,
  isActive,
  onClick,
}: {
  item: StoryStep
  index: number
  progress: MotionValue<number>
  isActive: boolean
  onClick: () => void
}) {
  const count = storySteps.length
  const segment = 1 / count
  const start = index * segment
  const end = (index + 1) * segment

  const scaleX = useTransform(progress, [start, end], [0.1, 1])

  return (
    <button
      type="button"
      className={isActive ? "is-active" : ""}
      aria-current={isActive ? "step" : undefined}
      aria-label={`${item.number}. ${item.title}`}
      onClick={onClick}
    >
      <span>{item.number}</span>
      <motion.i style={{ scaleX }} />
    </button>
  )
}

export default function AboutStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  })

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const next = Math.min(
      storySteps.length - 1,
      Math.floor(latest * storySteps.length)
    )
    setActiveIndex((current) => (current === next ? current : next))
  })

  const scrollToStep = (index: number) => {
    const section = sectionRef.current
    if (!section) return

    const scrollDistance = section.offsetHeight - window.innerHeight
    scrollWithLenis(
      section.offsetTop + scrollDistance * (index / storySteps.length + 0.012)
    )
  }

  return (
    <section
      ref={sectionRef}
      id="about-story"
      className="AboutStory"
      data-scroll-section
      data-scroll-label="Příběh"
      aria-label="Příběh Lucie Polanské"
    >
      <div className="aboutStory">
        <header className="aboutStory__header">
          <span>Příběh · Dvě kapitoly</span>
          <i />
          <span>Kdo za keramikou stojí</span>
        </header>

        <div className="aboutStory__stage">
          {storySteps.map((item, index) => (
            <ImageLayer
              item={item}
              index={index}
              progress={scrollYProgress}
              key={item.number}
            />
          ))}
        </div>

        <div className="aboutStory__copyStage">
          {storySteps.map((item, index) => (
            <CopyLayer
              item={item}
              index={index}
              progress={scrollYProgress}
              isActive={index === activeIndex}
              key={item.number}
            />
          ))}
        </div>

        <nav className="aboutStory__progress" aria-label="Kapitoly příběhu">
          {storySteps.map((item, index) => (
            <ProgressStep
              item={item}
              index={index}
              progress={scrollYProgress}
              isActive={index === activeIndex}
              onClick={() => scrollToStep(index)}
              key={item.number}
            />
          ))}
        </nav>
      </div>

      <div className="aboutStoryMobile">
        <header>
          <span>Příběh · Dvě kapitoly</span>
          <i />
        </header>
        {storySteps.map((item) => (
          <article className="aboutStoryMobile__chapter" key={item.number}>
            <figure>
              <Image src={item.src} alt={item.alt} fill sizes="100vw" />
              <figcaption>
                {item.number} · {item.label}
              </figcaption>
            </figure>
            <div>
              <span>
                {item.number} / 0{storySteps.length}
              </span>
              <h2>{item.title}</h2>
              <p className="aboutStoryMobile__lead">
                {item.lead} <em>{item.accent}</em>
              </p>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
