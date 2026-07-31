"use client"

import WebButton from "@modules/common/components/Buttons/webButton"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { motion, useScroll, useSpring, useTransform } from "framer-motion"
import { useRef } from "react"
import VerticalImageCarousel, {
  VerticalCarouselImage,
} from "./VerticalImageCarousel"

const courseImages: VerticalCarouselImage[] = [
  {
    id: 1,
    src: "/assets/img/img/2.jpg",
    alt: "Keramický kurz v ateliéru Lucie Polanské",
  },
  {
    id: 2,
    src: "/assets/img/img/3.jpg",
    alt: "Ruční modelování keramického objektu",
  },
]

export default function Courses() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  })
  const { scrollYProgress: entryProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "start start"],
  })
  const revealProgress = useSpring(scrollYProgress, {
    stiffness: 60,
    damping: 30,
    mass: 0.5,
    restDelta: 0.0005,
  })
  const entry = useSpring(entryProgress, {
    stiffness: 82,
    damping: 28,
    mass: 0.62,
    restDelta: 0.0005,
  })
  const shaderProgress = useTransform(
    [entry, revealProgress],
    ([entryValue, pinnedValue]: number[]) =>
      Math.min(1, entryValue * 0.66 + pinnedValue * 0.34)
  )
  const imageOpacity = useTransform(entry, [0.02, 0.62], [0.34, 1])
  const imageScale = useTransform(entry, [0.02, 0.94], [1.045, 1])
  const imageY = useTransform(entry, [0.02, 0.94], ["2%", "0%"])
  const contentOpacity = useTransform(entry, [0.74, 0.96], [0, 1])
  const contentY = useTransform(entry, [0.74, 0.96], [18, 0])
  const footerCurtain = useTransform(
    revealProgress,
    [0.76, 0.9],
    ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  )
  const footerRailOpacity = useTransform(revealProgress, [0.82, 0.9], [0, 1])
  const ctaOpacity = useTransform(revealProgress, [0.84, 0.93], [0, 1])
  const ctaY = useTransform(revealProgress, [0.84, 0.93], [32, 0])
  const ctaWindowOpacity = useTransform(revealProgress, [0.86, 0.94], [0, 1])
  const ctaWindowScale = useTransform(revealProgress, [0.8, 0.94], [0.86, 1])

  return (
    <section
      ref={sectionRef}
      className="courses__section"
      id="home-courses"
      data-scroll-section
      data-scroll-label="Kurzy"
    >
      <div className="courses__wrapper">
        <motion.div
          className="image__bg"
          style={{
            opacity: imageOpacity,
            scale: imageScale,
            y: imageY,
          }}
        >
          <VerticalImageCarousel
            images={courseImages}
            scrollProgress={shaderProgress}
          />
        </motion.div>

        <motion.div
          className="Courses__content"
          style={{ opacity: contentOpacity, y: contentY }}
        >
          <div className="Courses__meta">
            <span>04 · Kurzy</span>
            <span className="meta__line" />
            <span>Malé skupiny · Písek</span>
          </div>
          <div className="title">
            <h2>Hlína zpomalí čas.</h2>
            <em>Ruce najdou vlastní rytmus.</em>
          </div>
          <div className="Courses__footer">
            <p>
              Komorní kurzy pro děti i dospělé. Prostor pro soustředění,
              řemeslnou práci a radost z objektu, který vznikne jen jednou.
            </p>
            <WebButton
              Kind="Link"
              title="Objevit kurzy"
              href="/kurzy"
              alt="Objevit keramické kurzy"
              tone="dark"
            />
          </div>
        </motion.div>
        <motion.div
          className="Courses__footerCurtain"
          style={{ clipPath: footerCurtain }}
        >
          <div className="Courses__ctaSurface" aria-hidden="true" />
          <motion.div
            className="Courses__ctaWindow"
            style={{ opacity: ctaWindowOpacity, scale: ctaWindowScale }}
            aria-hidden="true"
          >
            <span>Ateliér · Písek</span>
          </motion.div>
          <motion.div
            className="Courses__footerRail"
            style={{ opacity: footerRailOpacity }}
          >
            <span>Pokračování</span>
            <span className="line" />
            <span>Objekty s vlastním příběhem</span>
          </motion.div>
          <div className="Courses__cta">
            <motion.div
              className="Courses__ctaInner"
              style={{ opacity: ctaOpacity, y: ctaY }}
            >
              <span className="Courses__ctaKicker">Z ateliéru do vašeho prostoru</span>
              <h2>
                Každý objekt
                <em>čeká na své místo.</em>
              </h2>
              <div className="Courses__ctaFooter">
                <p>
                  Objevte ručně vytvořené originály pro zahradu i domov.
                  Každý vznikl pomalu a pouze v malém počtu.
                </p>
                <div className="Courses__ctaActions">
                  <WebButton
                    Kind="Link"
                    title="Prohlédnout objekty"
                    href="/store"
                    alt="Prohlédnout keramické objekty"
                  />
                  <LocalizedClientLink href="/dotazy">
                    Nebo se zeptat Lucie <span aria-hidden="true">↗</span>
                  </LocalizedClientLink>
                </div>
              </div>
            </motion.div>
          </div>
          <motion.div
            className="Courses__ctaIndex"
            style={{ opacity: footerRailOpacity }}
          >
            <span>05</span>
            <span>Pokračujte do e-shopu</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
