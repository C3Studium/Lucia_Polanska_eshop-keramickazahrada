"use client"

import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import Image from "next/image"
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "framer-motion"
import { useRef, useState } from "react"

export const processSteps = [
  {
    number: "01",
    title: "Návrh",
    label: "Myšlenka · Funkce",
    lead: "Tvar začíná dřív, než se hlína dotkne rukou.",
    accent: "pozorováním.",
    text: "V přírodě hledám rytmus, proporci a klid. První návrh propojuje charakter objektu s tím, jak se bude držet, používat a přirozeně žít v prostoru.",
    src: "/assets/img/vyroba/1.png",
    alt: "První návrh keramického objektu",
  },
  {
    number: "02",
    title: "Modelování",
    label: "Dotek · Tvar",
    lead: "Ruce hledají správné",
    accent: "napětí.",
    text: "Hlína reaguje na každý tlak i drobnou změnu směru. Objekt roste pomalu, vrstvu po vrstvě, a jeho jemné nepravidelnosti zůstávají přiznanou stopou ruční práce.",
    src: "/assets/img/vyroba/2.png",
    alt: "Ruční modelování keramického objektu",
  },
  {
    number: "03",
    title: "Schnutí",
    label: "Čas · Trpělivost",
    lead: "Materiál potřebuje",
    accent: "čas.",
    text: "Hotový tvar musí schnout rovnoměrně a bez spěchu. Tichá fáze omezuje vnitřní pnutí a připravuje objekt na první setkání s ohněm.",
    src: "/assets/img/vyroba/3.png",
    alt: "Detail keramického objektu během schnutí",
  },
  {
    number: "04",
    title: "Přežah",
    label: "Oheň · První proměna",
    lead: "První oheň dává hlíně",
    accent: "stabilitu.",
    text: "Přežah zpevní křehký vysušený tvar a současně jej ponechá připravený přijmout glazuru. Každý objekt po výpalu pečlivě kontroluji.",
    src: "/assets/img/vyroba/4.png",
    alt: "Keramický objekt po prvním výpalu",
  },
  {
    number: "05",
    title: "Dekor",
    label: "Barva · Povrch",
    lead: "Povrch získává",
    accent: "vlastní hlas.",
    text: "Glazuru a dekor volím podle tvaru, světla a prostředí, ve kterém bude objekt žít. Barva nemá formu překrýt, ale zvýraznit její charakter.",
    src: "/assets/img/vyroba/5.png",
    alt: "Nanášení dekoru na keramický objekt",
  },
  {
    number: "06",
    title: "Výpal",
    label: "Oheň · Charakter",
    lead: "Druhý oheň rozhodne o",
    accent: "charakteru.",
    text: "Při závěrečném výpalu se propojí hlína, glazura a teplota. Výsledek lze vést zkušeností, nikdy jej však nelze zopakovat úplně stejně.",
    src: "/assets/img/vyroba/6.png",
    alt: "Hotový keramický objekt po závěrečném výpalu",
  },
  {
    number: "07",
    title: "Cesta",
    label: "Kontrola · Nový domov",
    lead: "Hotový objekt začíná",
    accent: "nový příběh.",
    text: "Každý kus naposledy prohlédnu, bezpečně zabalím a připravím na cestu. Z ateliéru odchází jako originál určený pro konkrétní domov nebo zahradu.",
    src: "/assets/img/img/1.jpg",
    alt: "Dokončený keramický objekt připravený pro nový domov",
  },
]

type ProcessStep = (typeof processSteps)[number]

export const firstProcessStep = processSteps[0]

export function ProcessCopyVisual({ item }: { item: ProcessStep }) {
  return (
    <>
      <div className="atelierProcess__index">
        <span>{item.number}</span>
        <i />
        <span>07</span>
      </div>

      <p className="atelierProcess__label">{item.label}</p>
      <h2>{item.title}</h2>

      <p className="atelierProcess__lead">
        {item.lead} <em>{item.accent}</em>
      </p>
      <p className="atelierProcess__body">{item.text}</p>
    </>
  )
}

export function ProcessImageVisual({
  item,
  imageStyle,
  edgeStyle,
  sizes = "(max-width: 760px) 100vw, 62vw",
}: {
  item: ProcessStep
  imageStyle?: MotionStyle
  edgeStyle?: MotionStyle
  sizes?: string
}) {
  return (
    <>
      <motion.div className="atelierProcess__imageInner" style={imageStyle}>
        <Image src={item.src} alt={item.alt} fill sizes={sizes} />
      </motion.div>
      <div className="atelierProcess__imageShade" aria-hidden="true" />
      <motion.i
        className="atelierProcess__kilnEdge"
        style={edgeStyle}
        aria-hidden="true"
      />
      <figcaption>
        <span>
          {item.number} · {item.label}
        </span>
        <i />
        <span>Ateliér · Písek</span>
      </figcaption>
    </>
  )
}

function ImageLayer({
  item,
  index,
  progress,
}: {
  item: ProcessStep
  index: number
  progress: MotionValue<number>
}) {
  const count = processSteps.length
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
  const edgeOpacity = useTransform(
    progress,
    index === 0
      ? [0, 0.001]
      : [
          revealStart,
          revealStart + segment * 0.08,
          revealEnd - segment * 0.05,
          revealEnd,
        ],
    index === 0 ? [0, 0] : [0, 0.72, 0.72, 0]
  )

  return (
    <motion.figure
      className="atelierProcess__image"
      style={{ clipPath, zIndex: index + 1 }}
    >
      <ProcessImageVisual
        item={item}
        imageStyle={{ y: imageY, scale: imageScale }}
        edgeStyle={{ opacity: edgeOpacity }}
      />
    </motion.figure>
  )
}

function CopyLayer({
  item,
  index,
  progress,
  isActive,
}: {
  item: ProcessStep
  index: number
  progress: MotionValue<number>
  isActive: boolean
}) {
  const count = processSteps.length
  const segment = 1 / count
  const start = index * segment
  const end = (index + 1) * segment

  const opacity = useTransform(
    progress,
    index === 0
      ? [0, end - segment * 0.22, end]
      : index === count - 1
      ? [start - segment * 0.24, start + segment * 0.14, 1]
      : [
          start - segment * 0.24,
          start + segment * 0.14,
          end - segment * 0.24,
          end,
        ],
    index === 0 ? [1, 1, 0] : index === count - 1 ? [0, 1, 1] : [0, 1, 1, 0]
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
      className="atelierProcess__copy"
      style={{ opacity, y }}
      aria-hidden={!isActive}
    >
      <ProcessCopyVisual item={item} />
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
  item: ProcessStep
  index: number
  progress: MotionValue<number>
  isActive: boolean
  onClick: () => void
}) {
  const count = processSteps.length
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

export default function Gallery() {
  const sectionRef = useRef<HTMLElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  })

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const next = Math.min(
      processSteps.length - 1,
      Math.floor(latest * processSteps.length)
    )
    setActiveIndex((current) => (current === next ? current : next))
  })

  const scrollToStep = (index: number) => {
    const section = sectionRef.current
    if (!section) return

    const scrollDistance = section.offsetHeight - window.innerHeight
    scrollWithLenis(
      section.offsetTop + scrollDistance * (index / processSteps.length + 0.012)
    )
  }

  return (
    <section
      ref={sectionRef}
      id="process-01"
      className="Gallery"
      data-scroll-section
      data-scroll-label="Sedm kroků"
      aria-label="Proces výroby keramiky"
    >
      <div className="atelierProcess">
        <header className="atelierProcess__header">
          <span>Proces · Sedm kapitol</span>
          <i />
          <span>Od myšlenky k originálu</span>
        </header>

        <div className="atelierProcess__stage">
          {processSteps.map((item, index) => (
            <ImageLayer
              item={item}
              index={index}
              progress={scrollYProgress}
              key={item.number}
            />
          ))}
        </div>

        <div className="atelierProcess__copyStage">
          {processSteps.map((item, index) => (
            <CopyLayer
              item={item}
              index={index}
              progress={scrollYProgress}
              isActive={index === activeIndex}
              key={item.number}
            />
          ))}
        </div>

        <nav className="atelierProcess__progress" aria-label="Kroky výroby">
          {processSteps.map((item, index) => (
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

      <div className="atelierProcessMobile">
        <header>
          <span>Proces · Sedm kapitol</span>
          <i />
        </header>
        {processSteps.map((item) => (
          <article className="atelierProcessMobile__chapter" key={item.number}>
            <figure>
              <Image src={item.src} alt={item.alt} fill sizes="100vw" />
              <figcaption>
                {item.number} · {item.label}
              </figcaption>
            </figure>
            <div>
              <span>{item.number} / 07</span>
              <h2>{item.title}</h2>
              <p className="atelierProcessMobile__lead">
                {item.lead} <em>{item.accent}</em>
              </p>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="Gallery__outro">
        <span>Výsledkem procesu je vždy originál</span>
        <h2>
          Stejný postup.
          <em> Nikdy stejný objekt.</em>
        </h2>
      </div>
    </section>
  )
}
