"use client"

import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import { editable } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import type { CopyBlock } from "@lib/util/site-copy"
import Image from "next/image"
import {
  cubicBezier,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "framer-motion"
import { useRef, useState } from "react"

/**
 * The two chapters of the old AboutInfo section, word for word — only the inline icons are
 * gone and the copy is recut into the process page's lead/accent/body rhythm. The visual
 * grammar is the vyroba page's, mirrored: the hero's portrait grows into this scene's plate
 * (vyroba anchors left and opens left→right, this one anchors right and opens right→left —
 * see omne/main), then images wipe in from below while copy cross-fades beside them — copy
 * column on the left, plate on the right.
 */
export const storySteps = [
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

export type StoryStep = (typeof storySteps)[number]

/*
 * Texty kapitol z bloku `o-mne.pribeh` — jedna položka `items` = jedna kapitola,
 * v pořadí, v jakém jdou na stránce.
 *
 * Kapitola má v kódu pět textů a položka čtyři pole, takže štítek nad nadpisem
 * („Písek · Bechyně") zůstává v kódu stejně jako u kroků výroby: je to
 * typografická ozdoba a číslo vedle něj drží pořadí, na kterém stojí scrollování.
 * Do CMS jdou ty, které se opravdu přepisují:
 *
 *   lead  = nadpis kapitoly („Kořeny")  — krátké slovo, vejde se do 24 znaků pole
 *   label = začátek úvodní věty („Jsem")
 *   note  = její zvýrazněný konec („písecká rodačka.")
 *   value = odstavec pod ní
 *
 * Počet kapitol je rozvržení, ne obsah: dvě kapitoly dělí timeline napůl, takže
 * položka navíc se nevykreslí a chybějící spadne na text z kódu.
 *
 * Používá to i hero (omne/main) pro náhled 1. kapitoly — předání má být tentýž
 * snímek, tedy i tentýž text.
 */
export const storyStepsFrom = (
  texts?: CopyBlock,
  photos?: CopyBlock
): StoryStep[] =>
  storySteps.map((item, index) => {
    const copy = texts?.items?.[index]
    const photo = photos?.gallery?.[STORY_OFFSET + index]
    return {
      ...item,
      title: copy?.lead?.trim() || item.title,
      lead: copy?.label?.trim() || item.lead,
      accent: copy?.note?.trim() || item.accent,
      text: copy?.value?.trim() || item.text,
      src: photo?.url ?? item.src,
      alt: photo?.alt?.trim() || item.alt,
    }
  })

/** Atributy překryvu pro texty jedné kapitoly. Mimo náhled prázdné objekty. */
type CopyEdit = {
  title?: Record<string, string | undefined>
  lead?: Record<string, string | undefined>
  accent?: Record<string, string | undefined>
  text?: Record<string, string | undefined>
}

/* Jen u kapitoly, která v bloku je — anotace na položku, která neexistuje, by
   v editoru nabídla pole, jehož uložení se nemá kam zapsat (viz itemFieldPath). */
const copyEdit = (texts: CopyBlock | undefined, index: number): CopyEdit =>
  texts?.items?.[index]
    ? {
        title: editable(texts, `items.${index}.lead`),
        lead: editable(texts, `items.${index}.label`),
        accent: editable(texts, `items.${index}.note`),
        text: editable(texts, `items.${index}.value`),
      }
    : {}

/*
 * Odkud v `o-mne.galerie` začínají fotky příběhu.
 *
 * Blok drží čtyři fotky stránky „O mně" v pořadí, v jakém na ní stojí: první
 * dvě kreslí hero shader nahoře (`AboutHeroShader`), další dvě tenhle příběh.
 * Jedna galerie, dva konzumenti — a offset je to jediné, co je od sebe dělí.
 *
 * Kdyby měl každý vlastní blok, editor by v „Texty na webu" viděl dvě položky
 * pro jednu stránku a musel by vědět, která je která. Takhle vidí jednu
 * galerii v pořadí, v jakém fotky na stránce potká.
 */
export const STORY_OFFSET = 2

/*
 * ─── Jedna timeline, jedno předání ──────────────────────────────────────────
 *
 * Deska do scény VJÍŽDÍ UŽ HOTOVÁ — na počítači i na telefonu: roste
 * z portrétu v hero sekci (omne/main), příběh je pod ní podtažený záporným
 * marginem, přesně jako předání výroby. Kapitoly si tady dělí celou timeline
 * rovným dílem a nic dalšího se tu nerozjíždí.
 *
 * Telefon měl chvíli vlastní růst uvnitř téhle sekce (razítko u okraje), a to
 * je právě ta „dvě oddělené komponenty" — hero skončí a příběh začne znovu.
 * Jedno předání pro obě šířky je i míň kódu: geometrii cíle drží
 * `--story-plate-*` ve stylu, takže se hero nemusí ptát, na čem běží.
 */
const SEGMENT = 1 / 2

/*
 * Křivka růstu desky — sdílí ji hero (omne/main) pro obě šířky: zvolný
 * rozjezd, dlouhý měkký dojezd, aby deska „dosedla". Scroll je lineární
 * vstup, plynulost dělá tahle křivka; VŠECHNY vlastnosti růstu ji musí
 * sdílet, jinak se box cestou bortí.
 *
 * Vybráno podle vrcholu rychlosti, ne od oka. Ostřejší varianty vyskočí ve
 * vrcholu na trojnásobek průměru (0.5,0.06,0.18,1 → 3.06×, naměřeno 87 px
 * šířky na 37px scrollu) a to se čte jako trhnutí, ne jako rozjezd. Tahle má
 * 1.83×, nejnižší zrychlení z porovnávaných — a pořád nechává 6 % dráhy na
 * poslední pětinu okna, takže deska dosedá, ne zastavuje.
 */
export const growEase = cubicBezier(0.4, 0, 0.5, 1)

/** Sdílený vizuál fotky kapitoly — vnitřek `.aboutStory__image`. Hero proxy
 *  v omne/main z něj skládá rostoucí desku, aby předání bylo tentýž pixel. */
export function StoryImageVisual({
  item,
  imageStyle,
  sizes = "(max-width: 760px) 100vw, 58vw",
  from,
  captionStyle,
}: {
  item: StoryStep
  imageStyle?: MotionStyle
  sizes?: string
  /**
   * Fotka, ZE KTERÉ se sem prolíná — hero proxy tudy podstrčí portrét z hero
   * sekce. Hero portrét a fotka první kapitoly jsou dva různé soubory
   * (o-mne-2 a o-mne-3, podobné snímky z jednoho focení), takže výměna
   * nemůže být neviditelná prolnutím na jednom místě; místo toho drží proxy
   * na začátku růstu přesně tu hero fotku a na tuhle se přebalí až uprostřed
   * dráhy, kde se deska hýbe nejrychleji. Oba švy tak sedí na tentýž snímek.
   */
  from?: { src: string; style?: MotionStyle }
  /** Popisek přichází s deskou, ne s výměnou fotky (viz omne/main). */
  captionStyle?: MotionStyle
}) {
  return (
    <>
      {/* Výchozí fotka leží VESPOD — ta cílová ji přebalí (clip-path v
          `imageStyle`), tak jako scéna odkrývá další kapitolu. Prolnutí přes
          průhlednost tu dělalo dvojexpozici, protože jsou to jiné snímky. */}
      {from ? (
        <motion.div className="aboutStory__imageInner" style={from.style}>
          {/* Dekorace — týž obsah nese vrstva nad ní. */}
          <Image src={from.src} alt="" fill sizes={sizes} aria-hidden="true" />
        </motion.div>
      ) : null}
      <motion.div className="aboutStory__imageInner" style={imageStyle}>
        <Image src={item.src} alt={item.alt} fill sizes={sizes} />
      </motion.div>
      <div className="aboutStory__imageShade" aria-hidden="true" />
      <motion.figcaption style={captionStyle}>
        <span>
          {item.number} · {item.label}
        </span>
        <i />
        <span>Ateliér · Písek</span>
      </motion.figcaption>
    </>
  )
}

/** Sdílený vizuál textu kapitoly — vnitřek `.aboutStory__copy`. */
export function StoryCopyVisual({
  item,
  edit = {},
}: {
  item: StoryStep
  /** Anotace jen u scény; náhled v hero (aria-hidden) je kopie a editovat se nemá. */
  edit?: CopyEdit
}) {
  return (
    <>
      <div className="aboutStory__index">
        <span>{item.number}</span>
        <i />
        <span>0{storySteps.length}</span>
      </div>

      <p className="aboutStory__label">{item.label}</p>
      <h2 {...edit.title}>{item.title}</h2>

      {/* Začátek věty ve vlastním (nestylovaném) spanu — `editable` píše celé
          pole naráz a zvýrazněný konec je pole jiné. */}
      <p className="aboutStory__lead">
        <span {...edit.lead}>{item.lead}</span> <em {...edit.accent}>{item.accent}</em>
      </p>
      <p className="aboutStory__body" {...edit.text}>{item.text}</p>
    </>
  )
}

function ImageLayer({
  item,
  index,
  progress,
  edit,
}: {
  item: StoryStep
  index: number
  progress: MotionValue<number>
  /** Atributy překryvu pro tuhle fotku. Mimo náhled prázdný objekt. */
  edit?: Record<string, string | undefined>
}) {
  const boundary = index * SEGMENT
  const revealStart = index === 0 ? 0 : boundary - SEGMENT * 0.26
  const revealEnd = boundary + SEGMENT * 0.16

  /* První fotka se neodkrývá — přijela hotová z hero. Další kapitoly si
     nechávají svislý přebal. */
  const clipPath = useTransform(
    progress,
    index === 0 ? [0, 1] : [revealStart, revealEnd],
    index === 0
      ? ["inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
      : ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  )
  const imageY = useTransform(
    progress,
    [revealStart, Math.min(1, revealEnd + SEGMENT * 0.7)],
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
      {...edit}
    >
      <StoryImageVisual
        item={item}
        imageStyle={{ y: imageY, scale: imageScale }}
      />
    </motion.figure>
  )
}

function CopyLayer({
  item,
  index,
  progress,
  isActive,
  edit,
}: {
  item: StoryStep
  index: number
  progress: MotionValue<number>
  isActive: boolean
  edit?: CopyEdit
}) {
  const start = index * SEGMENT
  const end = start + SEGMENT

  /* Kapitola 01 je tu od začátku — dojela s deskou z hero. Poslední už
     neodchází. */
  const opacity = useTransform(
    progress,
    index === 0
      ? [0, end - SEGMENT * 0.22, end]
      : [start - SEGMENT * 0.24, start + SEGMENT * 0.14, 1],
    index === 0 ? [1, 1, 0] : [0, 1, 1]
  )
  const y = useTransform(
    progress,
    [
      Math.max(0, start - SEGMENT * 0.2),
      start + SEGMENT * 0.16,
      Math.min(1, end),
    ],
    /*
     * Sesuv textu při přebalu kapitoly ve vh, ne v px.
     *
     * Referenční 1920x1080: 18px je 1.667vh, 12px je 1.11vh. Zaokrouhleno na
     * 1.6vh / -1.1vh, tedy 17.3 / -11.9 px na 1080 — v podstatě původní dráha.
     * Na 1220x660 z toho vyjde 10.6 / -7.3 px, na 2552x1351 pak 21.6 / -14.9:
     * sesuv drží stejný podíl okna jako zbytek kompozice, která visí na 70vh.
     * Všechny tři členy nesou stejnou jednotku, aby zůstaly interpolovatelné.
     */
    ["1.6vh", "0vh", "-1.1vh"]
  )

  return (
    <motion.article
      className="aboutStory__copy"
      style={{ opacity, y }}
      aria-hidden={!isActive}
    >
      <StoryCopyVisual item={item} edit={edit} />
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
  const start = index * SEGMENT

  const scaleX = useTransform(progress, [start, start + SEGMENT], [0.1, 1])

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

export default function AboutStory({
  block,
  texts,
}: {
  /** Blok `o-mne.galerie` — fotky kapitol (od `STORY_OFFSET`). */
  block?: CopyBlock
  /** Blok `o-mne.pribeh` — lišta nad scénou (`title`, `headline`) a kapitoly (viz `storyStepsFrom`). */
  texts?: CopyBlock
}) {
  /* Scéna jede jen ze scrollu — bez tohohle by po zapnutí editace zůstaly anotace prázdné. */
  useEditRerender()

  /*
   * Fotky z bloku `o-mne.galerie`, texty z `o-mne.pribeh` — stejné rozdělení
   * jako u galerie výroby: příběh má dvě kapitoly a na tom stojí scrollování,
   * takže se v CMS mění obrázky a slova, ne jejich počet. Chybějící fotka
   * nebo text v bloku znamená ten z kódu.
   */
  const steps = storyStepsFrom(texts, block)

  /* Lišta nad scénou: `title` a `headline` — dvě jednotlivá pole, ne dvě
     pozice v `accent` (CMS z něj prázdné položky vyhazuje a druhá by se
     posunula na místo první). `items` drží kapitoly a nic jiného. */
  const headerLead = texts?.title?.trim() || "Příběh · Dvě kapitoly"
  const headerTail = texts?.headline?.trim() || "Kdo za keramikou stojí"

  const sectionRef = useRef<HTMLElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  })

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const next = Math.min(
      storySteps.length - 1,
      Math.max(0, Math.floor(latest * storySteps.length))
    )
    setActiveIndex((current) => (current === next ? current : next))
  })

  const scrollToStep = (index: number) => {
    const section = sectionRef.current
    if (!section) return

    const scrollDistance = section.offsetHeight - window.innerHeight
    scrollWithLenis(
      section.offsetTop + scrollDistance * (index * SEGMENT + 0.012)
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
          <span {...editable(texts, "title")}>{headerLead}</span>
          <i />
          <span {...editable(texts, "headline")}>{headerTail}</span>
        </header>

        <div className="aboutStory__stage">
          {steps.map((item, index) => (
            <ImageLayer
              item={item}
              index={index}
              progress={scrollYProgress}
              edit={editable(block, `gallery.${STORY_OFFSET + index}`, "image")}
              key={item.number}
            />
          ))}
        </div>

        <div className="aboutStory__copyStage">
          {steps.map((item, index) => (
            <CopyLayer
              item={item}
              index={index}
              progress={scrollYProgress}
              isActive={index === activeIndex}
              edit={copyEdit(texts, index)}
              key={item.number}
            />
          ))}
        </div>

        <nav className="aboutStory__progress" aria-label="Kapitoly příběhu">
          {steps.map((item, index) => (
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
          {/* Tatáž lišta jako nad scénou — jedno pole, dvě místa. */}
          <span {...editable(texts, "title")}>{headerLead}</span>
          <i />
        </header>
        {/* `steps`, ne `storySteps`: seznam dřív četl přímo pole v kódu a fotka
            vyměněná v CMS se na telefonu naležato neukázala. */}
        {steps.map((item, index) => (
          <article className="aboutStoryMobile__chapter" key={item.number}>
            <figure {...editable(block, `gallery.${STORY_OFFSET + index}`, "image")}>
              <Image src={item.src} alt={item.alt} fill sizes="100vw" />
              <figcaption>
                {item.number} · {item.label}
              </figcaption>
            </figure>
            <div>
              <span>
                {item.number} / 0{storySteps.length}
              </span>
              <h2 {...copyEdit(texts, index).title}>{item.title}</h2>
              <p className="aboutStoryMobile__lead">
                <span {...copyEdit(texts, index).lead}>{item.lead}</span>{" "}
                <em {...copyEdit(texts, index).accent}>{item.accent}</em>
              </p>
              <p {...copyEdit(texts, index).text}>{item.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
