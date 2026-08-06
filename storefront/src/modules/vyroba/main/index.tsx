"use client"

import Image from "next/image"
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion"

import { heroBeat, heroReveal } from "@lib/motion-tokens"
import { useRef } from "react"
import {
  firstProcessStep,
  ProcessCopyVisual,
  ProcessImageVisual,
} from "@modules/vyroba/gallery"
import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"

export default function MainVyroba() {
  const timelineRef = useRef<HTMLDivElement>(null)
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

  const previewLeft = useTransform(
    scrollYProgress,
    [0.58, 0.99],
    ["8%", "4.5%"]
  )
  const previewTop = useTransform(scrollYProgress, [0.58, 0.99], ["56%", "15%"])
  const previewWidth = useTransform(
    scrollYProgress,
    [0.58, 0.99],
    ["19vw", "61vw"]
  )
  const previewHeight = useTransform(
    scrollYProgress,
    [0.58, 0.99],
    ["29%", "70%"]
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
          style={{
            opacity: handoffOpacity,
            pointerEvents: handoffPointerEvents,
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
              <span>Výroba · Keramická zahrada</span>
              <i />
              <span>Písek · Ručně od roku 2014</span>
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
              <div className="vyrobaHero__photoScale">
                <Image
                  src="/assets/img/vyroba/5.png"
                  alt="Lucie Polanská tvoří reliéf z keramické hlíny"
                  fill
                  priority
                  sizes="(max-width: 720px) 94vw, 56vw"
                />
              </div>
              <figcaption>
                <span>01 · Ruce a materiál</span>
                <i />
                <span>Ateliér · Písek</span>
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
                item={firstProcessStep}
                imageStyle={{ scale: previewImageScale, y: previewImageY }}
                edgeStyle={{ opacity: 0 }}
                sizes="(max-width: 720px) 38vw, 61vw"
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
              <Image
                src="/assets/img/vyroba/2.png"
                alt="Dokončený keramický objekt"
                fill
                sizes="(max-width: 720px) 34vw, 17vw"
              />
              <figcaption>Výsledek · Originál</figcaption>
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
              <ProcessCopyVisual item={firstProcessStep} />
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
            >
              Sedm kroků. Dvě setkání s ohněm.
            </motion.p>

            <h1>
              <motion.span
                className="vyrobaHero__line"
                variants={heroReveal}
                initial="hidden"
                animate="show"
                custom={heroBeat.lede}
              >
                <span>Než vznikne</span>
              </motion.span>
              <motion.span
                className="vyrobaHero__line vyrobaHero__line--accent"
                variants={heroReveal}
                initial="hidden"
                animate="show"
                custom={heroBeat.lede + 0.08}
              >
                <span>objekt.</span>
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
            >
              Materiál · Ruce · Oheň
            </motion.span>
            <p>
              Sedm kroků. Dva výpaly.
              <br />
              Jeden neopakovatelný výsledek.
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
              <span>Objevovat proces</span>
              <i aria-hidden="true" />
            </motion.button>
          </motion.footer>
        </motion.div>
      </div>
    </section>
  )
}
