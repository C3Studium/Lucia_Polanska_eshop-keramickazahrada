"use client"

import WebButton from "@modules/common/components/Buttons/webButton"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { motion, useScroll, useSpring, useTransform } from "framer-motion"
import { useRef } from "react"
import { useDeviceTier } from "@lib/hooks/use-device-tier"
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
    alt: "Ruční modelování keramického výrobku",
  },
]

const clamp01 = (value: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (value - from) / (to - from)))

/*
 * Beats of the pinned stage, as fractions of the pin.
 *
 * Everything used to happen in the last quarter — curtain at 0.76, rail 0.82, CTA 0.84, window
 * 0.86 — behind roughly 1.9 viewports in which nothing moved at all except the shader. Two and a
 * half screens of scrolling bought one still frame and then four overlapping reveals at the end.
 * The stage is shorter now (300vh, see style.scss), the middle drifts instead of sitting, and the
 * CTA gets its own stretch to arrive in rather than being crammed against the release.
 */
const DRIFT_END = 0.62
const CURTAIN_START = 0.5
const CURTAIN_END = 0.72
const WINDOW_START = 0.56
const WINDOW_END = 0.78
const CTA_START = 0.6
const CTA_END = 0.8
const RAIL_START = 0.66
const RAIL_END = 0.8

export default function Courses() {
  const sectionRef = useRef<HTMLElement>(null)
  const { isPhone } = useDeviceTier()
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
  /*
   * The hand-off cascade (Matěj, 2026-08-14). Two mechanisms make it tight:
   *
   * 1. The stage LEADS the scroll — during entry it rides up to 26 % of its
   *    height above its natural spot (tapering to 0 by 0.6, so the pin takes
   *    over seamlessly) and the section sits above Collections in z-order.
   *    The photo therefore climbs OVER the leaving grey curtain instead of
   *    waiting a whole viewport below it — the dark dead time is roughly cut
   *    in half.
   * 2. The beats right behind each other, as scroll fractions of the entry so
   *    scrubbing back replays them in reverse: grey cover melts 0.02–0.18 ·
   *    photo 0.03–0.18 with its own settle-scale · shader from 0.10 · content
   *    0.20–0.50.
   */
  /*
   * The stage runs ahead of the scroll on its way in, climbing over the grey curtain the
   * Collections scene leaves behind as it departs. A negative lead is what does the climbing —
   * and on a phone there is no curtain to climb over: Collections is a plain column of cards
   * there, so -26% of a viewport of dark stage was simply drawn across the last two of them.
   *
   * Positive instead, so the parallax survives: the stage still arrives late and settles into
   * place, it just does so from below its own box rather than from above it, and never covers
   * anything but itself.
   */
  const stageLead = useTransform(
    entry,
    [0, 0.6],
    [isPhone ? "8%" : "-26%", "0%"]
  )
  const entryCoverClip = useTransform(
    entry,
    [0.02, 0.18],
    ["inset(0% 0% 0% 0%)", "inset(100% 0% 0% 0%)"]
  )
  const shaderProgress = useTransform(
    [entry, revealProgress],
    ([entryValue, pinnedValue]: number[]) =>
      Math.min(
        1,
        Math.max(0, (entryValue - 0.1) * 1.5) * 0.55 + pinnedValue * 0.45
      )
  )
  const imageOpacity = useTransform(entry, [0.03, 0.18], [0.25, 1])
  /* Entry settles the over-scale early (by 0.5, right behind the cover melt);
     the pin then keeps drifting, which is what gives the long middle of this
     stage something to do besides the shader. */
  const imageScale = useTransform(
    [entry, revealProgress],
    ([entryValue, pinnedValue]: number[]) =>
      1.055 -
      0.055 * clamp01(entryValue, 0.03, 0.5) +
      0.045 * clamp01(pinnedValue, 0, DRIFT_END)
  )
  const imageY = useTransform(
    [entry, revealProgress],
    ([entryValue, pinnedValue]: number[]) =>
      `${
        2 -
        2 * clamp01(entryValue, 0.03, 0.5) -
        2.4 * clamp01(pinnedValue, 0, DRIFT_END)
      }%`
  )
  /* In by 0.20–0.50 of the entry — the last beat of the cascade, riding the
     led stage so it shows while the grey above is still leaving. Fades out
     under this section's own rising curtain later: left at full opacity it
     showed through the CTA's masked window — the tail of "A to je na tom to
     nejlepší." sat inside the circle on top of the photo. */
  const contentOpacity = useTransform(
    [entry, revealProgress],
    ([entryValue, pinnedValue]: number[]) =>
      clamp01(entryValue, 0.2, 0.5) *
      (1 - clamp01(pinnedValue, CURTAIN_START + 0.02, CURTAIN_END - 0.06))
  )
  const contentY = useTransform(
    [entry, revealProgress],
    ([entryValue, pinnedValue]: number[]) =>
      22 -
      22 * clamp01(entryValue, 0.2, 0.5) -
      26 * clamp01(pinnedValue, 0.08, DRIFT_END)
  )
  /* The section's own `pointer-events: auto` on links survives an opacity of 0, so the invisible
     "Objevit kurzy" would stay clickable over the CTA. visibility takes the children with it. */
  const contentVisibility = useTransform(contentOpacity, (value) =>
    value > 0.02 ? "visible" : "hidden"
  )
  const footerCurtain = useTransform(
    revealProgress,
    [CURTAIN_START, CURTAIN_END],
    ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  )
  const footerRailOpacity = useTransform(
    revealProgress,
    [RAIL_START, RAIL_END],
    [0, 1]
  )
  const ctaOpacity = useTransform(revealProgress, [CTA_START, CTA_END], [0, 1])
  const ctaY = useTransform(revealProgress, [CTA_START, CTA_END], [34, 0])
  const ctaWindowOpacity = useTransform(
    revealProgress,
    [WINDOW_START, WINDOW_START + 0.1],
    [0, 1]
  )
  /* Only a hair of scale: the photo showing through is a static CSS mask on the surface below and
     cannot scale with the ring, so a large range visibly separated the two. */
  const ctaWindowScale = useTransform(
    revealProgress,
    [WINDOW_START, WINDOW_END],
    [0.95, 1]
  )

  return (
    <section
      ref={sectionRef}
      className="courses__section"
      id="home-courses"
      data-scroll-section
      data-scroll-label="Kurzy"
    >
      <motion.div className="courses__wrapper" style={{ y: stageLead }}>
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

        {/* Grey continuation of Collections' exit curtain — same surface, so
            the seam between the sections is invisible. The clip wipes it open
            top-to-bottom right as the section enters, revealing the photo
            underneath (the „opens right away" part of the cascade). */}
        <motion.div
          className="Courses__entryCover"
          style={{ clipPath: entryCoverClip }}
          aria-hidden="true"
        />

        <motion.div
          className="Courses__content"
          style={{
            opacity: contentOpacity,
            y: contentY,
            visibility: contentVisibility,
          }}
        >
          <div className="Courses__meta">
            <span>04 · Kurzy</span>
            <span className="meta__line" />
            <span>Malé skupiny · Písek</span>
          </div>
          <div className="title">
            <h2>U hlíny se nedá spěchat.</h2>
            <em>A to je na tom to nejlepší.</em>
          </div>
          <div className="Courses__footer">
            <p>
              Kurzy pro děti i dospělé, vždycky v malé skupině. Pár hodin
              u hlíny — a domů si odnesete něco, co jste udělali sami.
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
            <span>Ručně, v píseckém ateliéru</span>
          </motion.div>
          <div className="Courses__cta">
            <motion.div
              className="Courses__ctaInner"
              style={{ opacity: ctaOpacity, y: ctaY }}
            >
              <span className="Courses__ctaKicker">Z ateliéru k vám domů</span>
              <h2>
                Každý výrobek
                <em>hledá svoje místo.</em>
              </h2>
              <div className="Courses__ctaFooter">
                <p>
                  Ručně tvořená keramika pro zahradu i domov. Všechno vzniká
                  pomalu a jen v malém počtu.
                </p>
                <div className="Courses__ctaActions">
                  <WebButton
                    Kind="Link"
                    title="Prohlédnout výrobky"
                    href="/store"
                    alt="Prohlédnout keramiku"
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
      </motion.div>
    </section>
  )
}
