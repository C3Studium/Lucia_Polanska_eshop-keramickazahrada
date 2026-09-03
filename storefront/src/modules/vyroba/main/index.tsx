"use client"

import { editable } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import type { CopyBlock } from "@lib/util/site-copy"
import Image from "next/image"
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion"

import { heroBeat, heroReveal } from "@lib/motion-tokens"
import { useEffect, useRef, useState } from "react"
import {
  firstProcessStep,
  ProcessCopyVisual,
  ProcessImageVisual,
} from "@modules/vyroba/gallery"
import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import { useDeviceTier } from "@lib/hooks/use-device-tier"

export default function MainVyroba({
  block,
  texts,
  galerie,
}: {
  block?: CopyBlock
  /** `vyroba.kroky` — kvůli anotacím náhledu prvního kroku, který tu jede v heru. */
  texts?: CopyBlock
  /** `vyroba.galerie` — fotka 1. kroku pro tentýž náhled. */
  galerie?: CopyBlock
}) {
  /* Scéna se hýbe jen hodnotami ze scrollu — bez tohohle by se po zapnutí režimu
     editace nepřekreslila a `editable()` by zůstalo prázdné. Viz hook. */
  useEditRerender()

  const railLeft = block?.accent?.[0]?.trim() || "Výroba · Keramická zahrada"
  const railRight = block?.accent?.[1]?.trim() || "Písek · Ručně od roku 2014"
  const eyebrow = block?.accent?.[2]?.trim() || "Sedm kroků a dva výpaly."
  const footerLabel = block?.accent?.[3]?.trim() || "Materiál · Ruce · Oheň"
  const scrollCta = block?.accent?.[4]?.trim() || "Objevovat proces"
  const stamp = block?.accent?.[5]?.trim() || "Ateliér · Písek"
  const titleLead = block?.title?.trim() || "Než vznikne"
  const titleAccent = block?.headline?.trim() || "jediný kus."
  const footerText = block?.bodyText?.trim() || ""
  /* Popisky fotek jsou řádky `items` — accent má ve schématu strop šesti položek
     a lišty a nadpisy ho vybraly. */
  const mainCaption = block?.items?.[0]?.label?.trim() || "01 · Ruce a materiál"
  const objectCaption = block?.items?.[1]?.label?.trim() || "Hotovo · Jediný kus"
  const mainPhoto = block?.gallery?.[0]
  const objectPhoto = block?.gallery?.[1]

  /* Náhled 1. kroku v heru — totéž znění jako v galerii níž: řádek 0 bloku
     `vyroba.kroky` přes hodnoty z kódu. Bez sloučení by přepsaný nadpis kroku
     platil dole, ale nahoře v náhledu by strašila stará verze. */
  const previewStep = {
    ...firstProcessStep,
    src: galerie?.gallery?.[0]?.url ?? firstProcessStep.src,
    alt: galerie?.gallery?.[0]?.alt?.trim() || firstProcessStep.alt,
    title: texts?.items?.[0]?.label?.trim() || firstProcessStep.title,
    text: texts?.items?.[0]?.value?.trim() || firstProcessStep.text,
    lead: texts?.items?.[0]?.lead?.trim() || firstProcessStep.lead,
    accent: texts?.items?.[0]?.note?.trim() || firstProcessStep.accent,
  }

  const timelineRef = useRef<HTMLDivElement>(null)
  const { isPhone } = useDeviceTier()

  /*
   * Upright phones get the gallery's sticky scene and its pull-up; phones on their side get the
   * stacked list and no overlap. The handoff below has to follow that split, and `isPhone` cannot
   * — it is true for both. The query is the `v(xs)`…below-`v(md)` band the stylesheet uses.
   */
  const [isPortraitPhone, setIsPortraitPhone] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(
      "(orientation: portrait) and (max-width: 599.98px)"
    )
    const sync = () => setIsPortraitPhone(query.matches)

    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start start", "end end"],
  })

  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const mainX = useSpring(pointerX, { stiffness: 90, damping: 24, mass: 0.7 })
  const mainY = useSpring(pointerY, { stiffness: 90, damping: 24, mass: 0.7 })
  const detailX = useTransform(mainX, (value) => value * -1.2)
  const detailY = useTransform(mainY, (value) => value * -1.2)
  const objectX = useTransform(mainX, (value) => value * 0.65)
  const objectY = useTransform(mainY, (value) => value * 0.65)

  const metaOpacity = useTransform(scrollYProgress, [0.16, 0.34], [1, 0])
  const metaY = useTransform(scrollYProgress, [0.16, 0.34], [0, -14])
  const footerOpacity = useTransform(scrollYProgress, [0.22, 0.42], [1, 0])
  const footerY = useTransform(scrollYProgress, [0.22, 0.42], [0, 22])
  const footerRuleScale = useTransform(scrollYProgress, [0.2, 0.44], [1, 0.1])
  const copyOpacity = useTransform(scrollYProgress, [0.28, 0.5], [1, 0])
  const copyY = useTransform(scrollYProgress, [0.28, 0.5], [0, -36])
  const objectOpacity = useTransform(scrollYProgress, [0.34, 0.56], [1, 0])
  const objectScale = useTransform(scrollYProgress, [0.34, 0.56], [1, 0.9])
  const mainImageOpacity = useTransform(scrollYProgress, [0.4, 0.68], [1, 0])
  const mainImageScale = useTransform(scrollYProgress, [0.4, 0.68], [1, 0.96])
  const lightLeakOpacity = useTransform(scrollYProgress, [0.38, 0.7], [0.26, 0])
  const handoffOpacity = useTransform(scrollYProgress, [0.96, 1], [1, 0])
  const handoffPointerEvents = useTransform(scrollYProgress, (progress) =>
    progress >= 0.985 ? "none" : "auto"
  )

  /*
   * The growing image, in the two proportions it has to work in.
   *
   * Wide, it starts as a thumbnail low on the left and opens into the plate the gallery's scene
   * is built on — a move across a stage that is half again as wide as it is tall. A phone's stage
   * is the other way up, so the same numbers give a 74px stamp at 390px that grows into something
   * still short of half the screen: technically the animation, visually nothing. Portrait it
   * starts larger, ends nearly full-bleed, and travels mostly vertically, which is the axis that
   * exists here.
   *
   * ─── The end of this move is not a number of its own ───────────────────────────────────────
   *
   * At progress 1 this figure has to be sitting exactly where `.atelierProcess__stage` is, because
   * the gallery is already behind it (`margin-top: -104vh`) and the stage above simply fades. It
   * used to end at a hand-copied `61vw`, which agreed with the gallery only while the frame was
   * the screen: above 1921 the frame narrows to `min(100vw, 100svh*1.6)` and the copy ran 238px
   * wider than the plate at 2552x1351 — 162px of it straight over the column of text beside it.
   *
   * So the end is `--process-stage-w` / `--process-stage-h` themselves, declared once in
   * `gallery/styles.scss` and inherited from `.main__vyrobaSticky`, and the start is a fraction of
   * that same plate rather than a second measurement of the screen. The fractions are the old
   * numbers written as what they always were — 19 of the plate's 61, 29 of its 70 — so nothing
   * below 1921 moves by a pixel.
   *
   * `* 1` on the end value is not noise: framer interpolates two strings only while they have the
   * same shape, so both ends need the same one number in the same place. (Same trap as
   * `min()` → `calc()`.)
   */
  const PLATE_W_START = (19 / 61).toFixed(4)
  const PLATE_H_START = (29 / 70).toFixed(4)
  const previewLeft = useTransform(
    scrollYProgress,
    [0.58, 0.99],
    isPhone ? ["17%", "4%"] : ["8%", "4.5%"]
  )
  const previewTop = useTransform(
    scrollYProgress,
    [0.58, 0.99],
    isPhone ? ["60%", "8%"] : ["56%", "15%"]
  )
  const previewWidth = useTransform(
    scrollYProgress,
    [0.58, 0.99],
    isPhone
      ? ["36vw", "92vw"]
      : [
          `calc(var(--process-stage-w) * ${PLATE_W_START})`,
          "calc(var(--process-stage-w) * 1)",
        ]
  )
  /*
   * It opens to nearly the whole frame, because on a phone the copy lands *on* the picture rather
   * than in a column beside it — the wide layout's 70% left the image ending mid-screen with the
   * text stranded underneath it on a dark ground, which is two compositions rather than one.
   */
  const previewHeight = useTransform(
    scrollYProgress,
    [0.58, 0.99],
    isPhone
      ? ["17%", "84%"]
      : [
          `calc(var(--process-stage-h) * ${PLATE_H_START})`,
          "calc(var(--process-stage-h) * 1)",
        ]
  )
  const previewClip = useTransform(
    scrollYProgress,
    [0.58, 0.99],
    [
      "polygon(4% 0%, 96% 2%, 100% 96%, 0% 100%)",
      "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
    ]
  )
  const previewImageScale = useTransform(
    scrollYProgress,
    [0.58, 0.99],
    [1.08, 1.045]
  )
  const previewImageY = useTransform(
    scrollYProgress,
    [0.58, 0.99],
    ["0%", "2.8%"]
  )
  const previewCopyOpacity = useTransform(scrollYProgress, [0.68, 0.92], [0, 1])
  const previewCopyY = useTransform(scrollYProgress, [0.68, 0.94], [42, 18])
  const previewCopyClip = useTransform(
    scrollYProgress,
    [0.68, 0.94],
    ["inset(10% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  )
  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - 0.5
    const y = (event.clientY - bounds.top) / bounds.height - 0.5

    pointerX.set(x * 7)
    pointerY.set(y * 5)
  }

  const resetPointer = () => {
    pointerX.set(0)
    pointerY.set(0)
  }

  const scrollToProcess = () => {
    const process = document.getElementById("process-01")
    if (process) scrollWithLenis(process)
  }

  return (
    <section
      className="main__vyroba"
      id="process-intro"
      data-scroll-section
      data-scroll-label="Úvod"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <div ref={timelineRef} className="main__vyrobaTimeline">
        <motion.div
          className="main__vyrobaSticky"
          /*
           * The handoff fade is desktop-only, and it is the seam.
           *
           * Wide, the gallery is pulled up under this stage by `margin-top: -104vh`, so the stage
           * has to dissolve to reveal what is already sitting behind it. On a phone that pull-up
           * is off — it would hide the mobile gallery's first chapter, which is flow content
           * there rather than a sticky lead-in — so there is nothing behind the stage to reveal.
           * Fading it out just emptied the screen, and then a whole viewport of charcoal scrolled
           * by before the gallery arrived.
           *
           * Left at full opacity, the stage simply scrolls away and the gallery follows it up.
           * Both sections are the same charcoal, so the join is the scroll itself.
           *
           * A plain `1` rather than dropping the property: framer does not clear a value it has
           * already written, and the first paint happens before `isPhone` is known.
           */
          style={{
            opacity: isPhone && !isPortraitPhone ? 1 : handoffOpacity,
            pointerEvents:
              isPhone && !isPortraitPhone ? "auto" : handoffPointerEvents,
          }}
        >
          <motion.div
            className="vyrobaHero__lightLeak"
            style={{ opacity: lightLeakOpacity }}
            aria-hidden="true"
          />

          <motion.header
            className="vyrobaHero__meta"
            style={{ opacity: metaOpacity, y: metaY }}
          >
            {/* The entrance sits on an inner element: the header's own opacity and y are motion
                values driven by scroll, and those win over `animate` for the same property. */}
            <motion.div
              className="vyrobaHero__metaInner"
              variants={heroReveal}
              initial="hidden"
              animate="show"
              custom={heroBeat.eyebrow}
            >
              <span {...editable(block, "accent.0")}>{railLeft}</span>
              <i />
              <span {...editable(block, "accent.1")}>{railRight}</span>
            </motion.div>
          </motion.header>

          <div className="vyrobaHero__visuals">
            <motion.figure
              className="vyrobaHero__photo vyrobaHero__photo--main"
              style={{
                x: mainX,
                y: mainY,
                opacity: mainImageOpacity,
                scale: mainImageScale,
              }}
            >
              <div
                className="vyrobaHero__photoScale"
                {...editable(block, "gallery.0", "image")}
              >
                <Image
                  src={mainPhoto?.url ?? "/assets/img/vyroba/5.png"}
                  alt={mainPhoto?.alt?.trim() || "Lucie Polanská tvoří reliéf z keramické hlíny"}
                  fill
                  priority
                  sizes="(max-width: 720px) 94vw, 56vw"
                />
              </div>
              <figcaption>
                <span {...editable(block, "items.0.label")}>{mainCaption}</span>
                <i />
                <span {...editable(block, "accent.5")}>{stamp}</span>
              </figcaption>
            </motion.figure>

            <motion.figure
              className="vyrobaHero__processProxy atelierProcess__image"
              style={{
                x: detailX,
                y: detailY,
                left: previewLeft,
                top: previewTop,
                width: previewWidth,
                height: previewHeight,
                clipPath: previewClip,
                right: "auto",
                bottom: "auto",
              }}
            >
              <ProcessImageVisual
                item={previewStep}
                imageStyle={{ scale: previewImageScale, y: previewImageY }}
                edgeStyle={{ opacity: 0 }}
                sizes="(max-width: 720px) 38vw, 61vw"
                stamp={stamp}
                editStamp={editable(block, "accent.5")}
              />
            </motion.figure>

            <motion.figure
              className="vyrobaHero__photo vyrobaHero__photo--object"
              style={{
                x: objectX,
                y: objectY,
                opacity: objectOpacity,
                scale: objectScale,
              }}
            >
              <span {...editable(block, "gallery.1", "image")}>
                <Image
                  src={objectPhoto?.url ?? "/assets/img/vyroba/2.png"}
                  alt={objectPhoto?.alt?.trim() || "Hotová keramika"}
                  fill
                  sizes="(max-width: 720px) 34vw, 17vw"
                />
              </span>
              <figcaption {...editable(block, "items.1.label")}>
                {objectCaption}
              </figcaption>
            </motion.figure>
          </div>

          <div
            className="vyrobaHero__processCopyStage atelierProcess__copyStage"
            aria-hidden="true"
          >
            <motion.article
              className="atelierProcess__copy"
              style={{
                opacity: previewCopyOpacity,
                y: previewCopyY,
                clipPath: previewCopyClip,
              }}
            >
              {/* Náhled 1. kroku — texty jsou tytéž řádky `vyroba.kroky` jako
                  v galerii níž, takže je editor může chytit už tady. */}
              <ProcessCopyVisual
                item={previewStep}
                edit={{
                  title: editable(texts, "items.0.label"),
                  text: editable(texts, "items.0.value"),
                  lead: editable(texts, "items.0.lead"),
                  accent: editable(texts, "items.0.note"),
                }}
              />
            </motion.article>
          </div>

          <motion.div
            className="vyrobaHero__copy"
            style={{ opacity: copyOpacity, y: copyY }}
          >
            <motion.p
              className="vyrobaHero__eyebrow"
              variants={heroReveal}
              initial="hidden"
              animate="show"
              custom={heroBeat.heading}
              {...editable(block, "accent.2")}
            >
              {eyebrow}
            </motion.p>

            <h1>
              <motion.span
                className="vyrobaHero__line"
                variants={heroReveal}
                initial="hidden"
                animate="show"
                custom={heroBeat.lede}
              >
                <span {...editable(block, "title")}>{titleLead}</span>
              </motion.span>
              <motion.span
                className="vyrobaHero__line vyrobaHero__line--accent"
                variants={heroReveal}
                initial="hidden"
                animate="show"
                custom={heroBeat.lede + 0.08}
              >
                <span {...editable(block, "headline")}>{titleAccent}</span>
              </motion.span>
            </h1>
          </motion.div>

          <motion.footer
            className="vyrobaHero__footer"
            style={{ opacity: footerOpacity, y: footerY }}
          >
            <motion.i
              className="vyrobaHero__footerRule"
              style={{ scaleX: footerRuleScale }}
              aria-hidden="true"
            />
            <motion.span
              className="vyrobaHero__footerLabel"
              variants={heroReveal}
              initial="hidden"
              animate="show"
              custom={heroBeat.action}
              {...editable(block, "accent.3")}
            >
              {footerLabel}
            </motion.span>
            {/* Zalomení drží jen výchozí znění z kódu; text z CMS se láme sám. */}
            <p {...editable(block, "body")}>
              {footerText || (
                <>
                  Sedm kroků, dva výpaly
                  <br />
                  a kus, který se už nezopakuje.
                </>
              )}
            </p>
            <motion.button
              type="button"
              onClick={scrollToProcess}
              className="vyrobaHero__scroll"
              variants={heroReveal}
              initial="hidden"
              animate="show"
              custom={heroBeat.chrome}
            >
              <span {...editable(block, "accent.4")}>{scrollCta}</span>
              <i aria-hidden="true" />
            </motion.button>
          </motion.footer>
        </motion.div>
      </div>
    </section>
  )
}
