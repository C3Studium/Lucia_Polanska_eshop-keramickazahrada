"use client"

import { motion } from "framer-motion"
import { usePathname } from "next/navigation"
import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import styles from "./style.module.scss"

type ScrollSection = {
  element: HTMLElement
  id: string
  label: string
  subdivisions: number
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

const labelAnim = {
  hidden: {
    transition: {
      staggerChildren: 0.012,
      staggerDirection: 1,
    },
  },
  visible: {
    transition: {
      delayChildren: 0.035,
      staggerChildren: 0.026,
      staggerDirection: -1,
    },
  },
} as const

const charAnim = {
  hidden: {
    opacity: 0,
    x: "0.85em",
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1],
    },
  },
} as const

const markerSpring = {
  type: "spring",
  stiffness: 165,
  damping: 25,
  mass: 0.72,
} as const

const getPageSections = (): ScrollSection[] => {
  const explicitSections = Array.from(
    document.querySelectorAll<HTMLElement>("[data-scroll-section]")
  )
  const candidates =
    explicitSections.length > 0
      ? explicitSections
      : Array.from(
          document.querySelectorAll<HTMLElement>(
            "main > section, main > [role='region']"
          )
        )

  if (!candidates.length) {
    const main = document.querySelector<HTMLElement>("main")
    if (main) {
      candidates.push(main)
    }
  }

  return candidates
    .filter((element) => {
      const styles = window.getComputedStyle(element)
      return styles.display !== "none" && element.offsetHeight > 1
    })
    .map((element, index) => {
      const id = element.id || `page-section-${index + 1}`
      const label =
        element.dataset.scrollLabel ||
        element.getAttribute("aria-label") ||
        `Sekce ${index + 1}`

      if (!element.id) {
        element.id = id
      }

      const viewportHeight = Math.max(window.innerHeight, 1)
      const sectionViewports = element.offsetHeight / viewportHeight
      const subdivisions = Math.min(
        16,
        Math.max(5, Math.round(sectionViewports * 4))
      )

      return { element, id, label, subdivisions }
    })
}

export default function Scrollbar() {
  const pathname = usePathname()
  const [sections, setSections] = useState<ScrollSection[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [sectionProgress, setSectionProgress] = useState(0)
  const [hoveredMarker, setHoveredMarker] = useState<number | null>(null)
  const frame = useRef<number | null>(null)

  const measure = useCallback(() => {
    if (!sections.length) return

    const readingLine = window.scrollY + window.innerHeight * 0.42
    let nextActive = 0

    sections.forEach((section, index) => {
      const top = section.element.getBoundingClientRect().top + window.scrollY
      if (top <= readingLine) {
        nextActive = index
      }
    })

    const active = sections[nextActive]
    const activeTop =
      active.element.getBoundingClientRect().top + window.scrollY
    const nextTop = sections[nextActive + 1]
      ? sections[nextActive + 1].element.getBoundingClientRect().top +
        window.scrollY
      : activeTop + Math.max(active.element.offsetHeight, window.innerHeight)
    const distance = Math.max(nextTop - activeTop, 1)
    const progress = Math.min(
      1,
      Math.max(0, (readingLine - activeTop) / distance)
    )

    setActiveIndex((current) => (current === nextActive ? current : nextActive))
    setSectionProgress(progress)
  }, [sections])

  useEffect(() => {
    let discoveryFrame = 0
    let cancelled = false

    const discover = () => {
      const nextSections = getPageSections()
      setSections(nextSections)
    }

    const scheduleDiscovery = () => {
      window.cancelAnimationFrame(discoveryFrame)
      discoveryFrame = window.requestAnimationFrame(discover)
    }

    scheduleDiscovery()
    const observer = new MutationObserver(scheduleDiscovery)
    const resizeObserver = new ResizeObserver(scheduleDiscovery)

    observer.observe(document.body, { childList: true, subtree: true })
    resizeObserver.observe(document.body)
    document.fonts.ready.then(() => {
      if (!cancelled) scheduleDiscovery()
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(discoveryFrame)
      observer.disconnect()
      resizeObserver.disconnect()
    }
  }, [pathname])

  useEffect(() => {
    const requestMeasure = () => {
      if (frame.current !== null) return
      frame.current = window.requestAnimationFrame(() => {
        measure()
        frame.current = null
      })
    }

    measure()
    window.addEventListener("scroll", requestMeasure, { passive: true })
    window.addEventListener("resize", requestMeasure)

    return () => {
      window.removeEventListener("scroll", requestMeasure)
      window.removeEventListener("resize", requestMeasure)
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current)
      }
    }
  }, [measure])

  const scrollToSection = (
    event: MouseEvent<HTMLAnchorElement>,
    section: ScrollSection
  ) => {
    event.preventDefault()
    scrollWithLenis(section.element)
    window.history.replaceState(null, "", `#${section.id}`)
  }

  const scrollToSubdivision = (sectionIndex: number, subdivision: number) => {
    const section = sections[sectionIndex]
    if (!section) return

    const sectionTop =
      section.element.getBoundingClientRect().top + window.scrollY
    const nextSection = sections[sectionIndex + 1]
    const sectionEnd = nextSection
      ? nextSection.element.getBoundingClientRect().top + window.scrollY
      : sectionTop + Math.max(section.element.offsetHeight, window.innerHeight)
    const sectionDistance = Math.max(sectionEnd - sectionTop, 1)
    const destination =
      sectionTop +
      sectionDistance * ((subdivision + 1) / (section.subdivisions + 1))

    scrollWithLenis(destination)
  }

  if (!sections.length) return null

  const markerOffsets: number[] = []
  let markerCount = 0

  sections.forEach((section, index) => {
    markerOffsets.push(markerCount)
    markerCount += 1
    if (index < sections.length - 1) {
      markerCount += section.subdivisions
    }
  })

  const markerScale = (
    position: number,
    restingScale: number,
    maximumScale = 1
  ) => {
    if (hoveredMarker === null) return restingScale

    const distance = Math.abs(hoveredMarker - position)
    const localInfluence = clamp(1 - distance / 7)
    const influence = 0.08 + localInfluence * 0.92

    return restingScale + (maximumScale - restingScale) * influence
  }

  const hoveredSectionIndex =
    hoveredMarker === null
      ? null
      : markerOffsets.reduce(
          (closest, offset, index) =>
            offset <= hoveredMarker ? index : closest,
          0
        )

  const handleRailPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const directMarker = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-rail-marker]"
    )

    if (directMarker) {
      setHoveredMarker(Number(directMarker.dataset.railMarker))
      return
    }

    const markers = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("[data-rail-marker]")
    )
    let closestPosition = 0
    let closestDistance = Number.POSITIVE_INFINITY

    markers.forEach((marker) => {
      const bounds = marker.getBoundingClientRect()
      const distance = Math.abs(
        event.clientY - (bounds.top + bounds.height / 2)
      )

      if (distance < closestDistance) {
        closestDistance = distance
        closestPosition = Number(marker.dataset.railMarker)
      }
    })

    setHoveredMarker(closestPosition)
  }

  const handleRailClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-rail-marker]")) return

    const markers = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("[data-rail-marker]")
    )
    const nearestMarker = markers
      .map((marker) => {
        const bounds = marker.getBoundingClientRect()
        return {
          marker,
          distance: Math.abs(event.clientY - (bounds.top + bounds.height / 2)),
        }
      })
      .sort((a, b) => a.distance - b.distance)[0]?.marker

    nearestMarker?.click()
  }

  return (
    <nav className={styles.sidebar} aria-label="Navigace v této stránce">
      <div
        className={styles.rail}
        onPointerMove={handleRailPointerMove}
        onPointerLeave={() => setHoveredMarker(null)}
        onClick={handleRailClick}
      >
        {sections.map((section, index) => {
          const position = markerOffsets[index]
          const restingScale = index === activeIndex ? 1 : 0.56
          const lineScale = markerScale(position, restingScale)
          const lineProgress =
            index < activeIndex
              ? 1
              : index === activeIndex
              ? sectionProgress
              : 0
          const labelVisible =
            hoveredMarker !== null &&
            (index === activeIndex || index === hoveredSectionIndex)
          const itemStyle = {
            "--line-progress": lineProgress,
          } as CSSProperties

          return (
            <Fragment key={section.id}>
              <a
                href={`#${section.id}`}
                className={styles.item}
                data-active={index === activeIndex || undefined}
                aria-current={index === activeIndex ? "location" : undefined}
                aria-label={section.label}
                style={itemStyle}
                data-rail-marker={position}
                onClick={(event) => scrollToSection(event, section)}
                onFocus={() => setHoveredMarker(position)}
                onBlur={() => setHoveredMarker(null)}
              >
                <motion.span
                  className={styles.label}
                  variants={labelAnim}
                  initial="hidden"
                  animate={labelVisible ? "visible" : "hidden"}
                  data-visible={labelVisible || undefined}
                  aria-hidden="true"
                >
                  {Array.from(section.label).map(
                    (character, characterIndex) => (
                      <motion.i
                        variants={charAnim}
                        key={`${section.id}-${characterIndex}`}
                      >
                        {character === " " ? "\u00A0" : character}
                      </motion.i>
                    )
                  )}
                </motion.span>
                <motion.span
                  className={styles.lineTrack}
                  initial={false}
                  animate={{ scaleX: lineScale }}
                  transition={markerSpring}
                  aria-hidden="true"
                >
                  <i className={styles.lineBase} />
                  <i className={styles.lineProgress} />
                </motion.span>
              </a>

              {index < sections.length - 1 &&
                Array.from(
                  { length: section.subdivisions },
                  (_, subdivision) => {
                    const stepSize = 1 / section.subdivisions
                    const stepStart = subdivision * stepSize
                    const visualScale =
                      0.58 + ((subdivision * 7 + index * 3) % 5) * 0.05
                    const position = markerOffsets[index] + subdivision + 1
                    const scale = markerScale(position, visualScale, 1.14)
                    const progress =
                      index < activeIndex
                        ? 1
                        : index === activeIndex
                        ? clamp((sectionProgress - stepStart) / stepSize)
                        : 0

                    return (
                      <motion.button
                        type="button"
                        className={styles.minorTrack}
                        style={
                          {
                            "--line-progress": progress,
                          } as CSSProperties
                        }
                        initial={false}
                        animate={{ scaleX: scale }}
                        transition={markerSpring}
                        aria-label={`${section.label}, ${Math.round(
                          ((subdivision + 1) / (section.subdivisions + 1)) * 100
                        )} %`}
                        data-rail-marker={position}
                        key={`${section.id}-step-${subdivision}`}
                        onClick={() => scrollToSubdivision(index, subdivision)}
                        onFocus={() => setHoveredMarker(position)}
                        onBlur={() => setHoveredMarker(null)}
                      >
                        <i className={styles.lineBase} />
                        <i className={styles.lineProgress} />
                      </motion.button>
                    )
                  }
                )}
            </Fragment>
          )
        })}
      </div>
    </nav>
  )
}
