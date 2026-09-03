"use client"

import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import { editable } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import type { CopyBlock } from "@lib/util/site-copy"
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
    lead: "Tvar mám v hlavě dřív, než sáhnu po hlíně.",
    accent: "pozorováním.",
    text: "Nápady sbírám venku — v zahradě, v krajině, na obyčejných věcech kolem. U prvního návrhu už myslím na to, jak se to bude držet v ruce a kam si to doma dáte.",
    src: "/assets/img/vyroba/1.png",
    alt: "První návrh keramického výrobku",
  },
  {
    number: "02",
    title: "Modelování",
    label: "Dotek · Tvar",
    lead: "Ruce hledají správné",
    accent: "napětí.",
    text: "Hlína pozná každý tlak a každou změnu směru. Roste to pomalu, vrstvu po vrstvě, a drobné nepravidelnosti nechávám být — podle nich poznáte, že to není ze stroje.",
    src: "/assets/img/vyroba/2.png",
    alt: "Ruční modelování keramiky",
  },
  {
    number: "03",
    title: "Schnutí",
    label: "Čas · Trpělivost",
    lead: "Materiál potřebuje",
    accent: "čas.",
    text: "Hotový tvar musí schnout pomalu a rovnoměrně, jinak popraská. Tahle nudná část rozhoduje o tom, jestli výrobek přežije první výpal.",
    src: "/assets/img/vyroba/3.png",
    alt: "Keramika během schnutí",
  },
  {
    number: "04",
    title: "Přežah",
    label: "Oheň · První proměna",
    lead: "První oheň dává hlíně",
    accent: "stabilitu.",
    text: "Přežah vysušenou hlínu zpevní a připraví ji na glazuru. Každý kus po výpalu pečlivě prohlédnu.",
    src: "/assets/img/vyroba/4.png",
    alt: "Keramika po prvním výpalu",
  },
  {
    number: "05",
    title: "Dekor",
    label: "Barva · Povrch",
    lead: "Povrch získává",
    accent: "vlastní hlas.",
    text: "Glazuru vybírám podle tvaru a podle toho, kde bude výrobek stát. Barva nemá tvar přebít — má ho vytáhnout.",
    src: "/assets/img/vyroba/5.png",
    alt: "Nanášení dekoru na keramiku",
  },
  {
    number: "06",
    title: "Výpal",
    label: "Oheň · Charakter",
    lead: "Druhý oheň rozhodne o",
    accent: "charakteru.",
    text: "V peci se potká hlína, glazura a teplota. Zkušeností se to dá vést, ale úplně stejně to podruhé nevyjde nikdy.",
    src: "/assets/img/vyroba/6.png",
    alt: "Hotová keramika po závěrečném výpalu",
  },
  {
    number: "07",
    title: "Cesta",
    label: "Kontrola · Nový domov",
    lead: "A pak už jen",
    accent: "cesta k vám.",
    text: "Každý kus naposledy prohlédnu, pořádně zabalím a připravím na cestu. Z ateliéru odchází jako jediný svého druhu — pro konkrétní dům nebo zahradu.",
    src: "/assets/img/img/1.jpg",
    alt: "Hotová keramika připravená na cestu",
  },
]

type ProcessStep = (typeof processSteps)[number]

export const firstProcessStep = processSteps[0]

export function ProcessCopyVisual({
  item,
  edit,
}: {
  item: ProcessStep
  edit?: {
    title?: Record<string, string | undefined>
    text?: Record<string, string | undefined>
    lead?: Record<string, string | undefined>
    accent?: Record<string, string | undefined>
  }
}) {
  return (
    <>
      <div className="atelierProcess__index">
        <span>{item.number}</span>
        <i />
        <span>07</span>
      </div>

      {/* Štítek zůstává v kódu — je to typografická ozdoba („Myšlenka · Funkce"),
          ne věta, kterou by kdo přepisoval. */}
      <p className="atelierProcess__label">{item.label}</p>
      <h2 {...edit?.title}>{item.title}</h2>

      <p className="atelierProcess__lead">
        <span {...edit?.lead}>{item.lead}</span>{" "}
        <em {...edit?.accent}>{item.accent}</em>
      </p>
      <p className="atelierProcess__body" {...edit?.text}>{item.text}</p>
    </>
  )
}

export function ProcessImageVisual({
  item,
  imageStyle,
  edgeStyle,
  sizes = "(max-width: 760px) 100vw, 62vw",
  stamp = "Ateliér · Písek",
  editStamp,
}: {
  item: ProcessStep
  imageStyle?: MotionStyle
  edgeStyle?: MotionStyle
  sizes?: string
  /** Pravá půlka popisku fotky — z bloku `vyroba.kroky`, accent.2. */
  stamp?: string
  editStamp?: Record<string, string | undefined>
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
        {/* Číslo a štítek jsou struktura (drží pořadí a navigaci), zůstávají v kódu. */}
        <span>
          {item.number} · {item.label}
        </span>
        <i />
        <span {...editStamp}>{stamp}</span>
      </figcaption>
    </>
  )
}

function ImageLayer({
  item,
  index,
  progress,
  edit,
  stamp,
  editStamp,
}: {
  item: ProcessStep
  index: number
  progress: MotionValue<number>
  /** Atributy překryvu pro tuhle fotku. Mimo náhled prázdný objekt. */
  edit?: Record<string, string | undefined>
  stamp?: string
  editStamp?: Record<string, string | undefined>
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
      {...edit}
    >
      <ProcessImageVisual
        item={item}
        imageStyle={{ y: imageY, scale: imageScale }}
        edgeStyle={{ opacity: edgeOpacity }}
        stamp={stamp}
        editStamp={editStamp}
      />
    </motion.figure>
  )
}

/*
 * Vjezd a výjezd odstavce kapitoly — ve výšce okna, ne v pixelech.
 *
 * Bylo `[18, 0, -12]`, což framer bere jako px. To je 2 % a 1.33 % z 900px okna, na kterém
 * se scéna skládala; na 1220×660 by ale týž pohyb byl 2.7 % a na 2552×1351 jen 1.3 %. Ve vh
 * je to na každé obrazovce stejný díl obrazu. Výjezd jsou dvě třetiny vjezdu, odvozené,
 * ne opsané. Všechny tři členy mají tvar „<číslo>vh", jinak přestanou být interpolovatelné.
 */
const COPY_ENTER_VH = 2
const COPY_EXIT_VH = -(COPY_ENTER_VH * 2) / 3
const COPY_TRAVEL = [
  `${COPY_ENTER_VH}vh`,
  "0vh",
  `${COPY_EXIT_VH.toFixed(2)}vh`,
]

function CopyLayer({
  item,
  index,
  progress,
  isActive,
  edit,
}: {
  item: ProcessStep
  index: number
  progress: MotionValue<number>
  isActive: boolean
  /** Atributy překryvu pro texty kroku. Mimo náhled prázdné. */
  edit?: {
    title?: Record<string, string | undefined>
    text?: Record<string, string | undefined>
    lead?: Record<string, string | undefined>
    accent?: Record<string, string | undefined>
  }
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
    COPY_TRAVEL
  )

  return (
    <motion.article
      className="atelierProcess__copy"
      style={{ opacity, y }}
      aria-hidden={!isActive}
    >
      <ProcessCopyVisual item={item} edit={edit} />
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

export default function Gallery({
  block,
  texts,
}: {
  /** `vyroba.galerie` — fotky kroků. */
  block?: CopyBlock
  /** `vyroba.kroky` — nadpisy, odstavce a zvýrazněné konce. */
  texts?: CopyBlock
}) {
  /* Scéna jede jen ze scrollu — bez tohohle by po zapnutí editace zůstaly anotace prázdné. */
  useEditRerender()

  /*
   * Fotky z CMS, texty z kódu.
   *
   * `processSteps` nese obojí — číslo, nadpis, popis kroku i obrázek —, ale do
   * CMS jde jen ten obrázek. Sedm kroků výroby je struktura stránky, ne obsah,
   * který se mění: kdyby šlo v CMS ubrat krok, rozpadl by se scrollovací
   * mechanismus, který na jejich počtu stojí. Fotku vyměnit lze kdykoli.
   *
   * Chybějící fotka v bloku znamená tu z kódu — galerie tak nikdy nemá díru.
   */
  const steps = processSteps.map((item, index) => {
    const photo = block?.gallery?.[index]
    /*
     * Texty z bloku `vyroba.kroky`. Mapování je dané schématem `items`:
     * `label` je nadpis kroku, `value` odstavec pod ním, `note` zvýrazněný
     * konec věty. `lead` nese číslo, ale to se z CMS nebere — drží pořadí,
     * na kterém stojí scrollování, a přepsat ho v CMS by rozbilo chování
     * stránky, ne jen její text.
     */
    const copy = texts?.items?.[index]
    return {
      ...item,
      src: photo?.url ?? item.src,
      alt: photo?.alt?.trim() || item.alt,
      title: copy?.label?.trim() || item.title,
      text: copy?.value?.trim() || item.text,
      accent: copy?.note?.trim() || item.accent,
      /* `lead` v bloku dřív nesl číslo kroku, které se odsud stejně nečte
         (pořadí drží kód) — slot teď patří uvozující větě, aby šla upravit. */
      lead: copy?.lead?.trim() || item.lead,
      /** Kolikátý krok to je, pro anotaci překryvu. */
      cmsIndex: index,
    }
  })

  const railLeft = texts?.accent?.[0]?.trim() || "Proces · Sedm kapitol"
  const railRight = texts?.accent?.[1]?.trim() || "Od nápadu k hotovému kusu"
  const stamp = texts?.accent?.[2]?.trim() || "Ateliér · Písek"
  const outroEyebrow = texts?.accent?.[3]?.trim() || "Každý kus je jiný"
  const outroLead = texts?.accent?.[4]?.trim() || "Stejný postup,"
  const outroAccent = texts?.headline?.trim() || "pokaždé jiný výsledek."

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
          <span {...editable(texts, "accent.0")}>{railLeft}</span>
          <i />
          <span {...editable(texts, "accent.1")}>{railRight}</span>
        </header>

        <div className="atelierProcess__stage">
          {steps.map((item, index) => (
            <ImageLayer
              item={item}
              index={index}
              progress={scrollYProgress}
              edit={editable(block, `gallery.${index}`, "image")}
              stamp={stamp}
              editStamp={editable(texts, "accent.2")}
              key={item.number}
            />
          ))}
        </div>

        <div className="atelierProcess__copyStage">
          {steps.map((item, index) => (
            <CopyLayer
              item={item}
              index={index}
              progress={scrollYProgress}
              isActive={index === activeIndex}
              edit={{
                title: editable(texts, `items.${index}.label`),
                text: editable(texts, `items.${index}.value`),
                lead: editable(texts, `items.${index}.lead`),
                accent: editable(texts, `items.${index}.note`),
              }}
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
          <span {...editable(texts, "accent.0")}>{railLeft}</span>
          <i />
        </header>
        {/* `steps`, ne `processSteps`: mobilní větev dřív četla přímo pole v kódu
            a vyměněná fotka nebo přepsaný text z CMS se na telefonu neukázaly. */}
        {steps.map((item, index) => (
          <article className="atelierProcessMobile__chapter" key={item.number}>
            <figure {...editable(block, `gallery.${index}`, "image")}>
              <Image src={item.src} alt={item.alt} fill sizes="100vw" />
              <figcaption>
                {item.number} · {item.label}
              </figcaption>
            </figure>
            <div>
              <span>{item.number} / 07</span>
              <h2 {...editable(texts, `items.${index}.label`)}>{item.title}</h2>
              <p className="atelierProcessMobile__lead">
                <span {...editable(texts, `items.${index}.lead`)}>{item.lead}</span>{" "}
                <em {...editable(texts, `items.${index}.note`)}>{item.accent}</em>
              </p>
              <p {...editable(texts, `items.${index}.value`)}>{item.text}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="Gallery__outro">
        <span {...editable(texts, "accent.3")}>{outroEyebrow}</span>
        {/* Obě půlky vlastní pole — `editable` píše celé pole naráz. */}
        <h2>
          <span {...editable(texts, "accent.4")}>{outroLead}</span>
          <em {...editable(texts, "headline")}> {outroAccent}</em>
        </h2>
      </div>
    </section>
  )
}
