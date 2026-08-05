"use client"

import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import WebButton from "@modules/common/components/Buttons/webButton"
import { motion, useInView } from "framer-motion"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import styles from "./style.module.scss"

export type LegalSectionData = {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

type LegalDocumentProps = {
  code: string
  eyebrow: string
  title: string
  accent: string
  description: string
  updated?: string
  sections: LegalSectionData[]
  supplements?: Record<string, ReactNode>
}

function Chapter({
  section,
  index,
  supplement,
}: {
  section: LegalSectionData
  index: number
  supplement?: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" })

  return (
    <motion.section
      ref={ref}
      id={section.id}
      className={styles.chapter}
      aria-labelledby={`${section.id}-title`}
      initial={false}
      animate={
        isInView
          ? { opacity: 1, y: 0 }
          : { opacity: 0.28, y: 24 }
      }
      transition={transition}
    >
      <div className={styles.chapterRule} aria-hidden="true">
        <motion.span
          initial={false}
          animate={{ scaleX: isInView ? 1 : 0.08 }}
          transition={transition2}
        />
      </div>

      <div className={styles.chapterHeading}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <h2 id={`${section.id}-title`}>{section.title}</h2>
      </div>

      <div className={styles.chapterBody}>
        {section.paragraphs?.filter(Boolean).map((paragraph, paragraphIndex) => (
          <p key={paragraphIndex}>{paragraph}</p>
        ))}

        {!!section.bullets?.filter(Boolean).length && (
          <ul>
            {section.bullets.filter(Boolean).map((bullet, bulletIndex) => (
              <li key={bulletIndex}>{bullet}</li>
            ))}
          </ul>
        )}

        {supplement}
      </div>
    </motion.section>
  )
}

export default function LegalDocument({
  code,
  eyebrow,
  title,
  accent,
  description,
  updated = "Aktuální znění",
  sections,
  supplements,
}: LegalDocumentProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "")

  useEffect(() => {
    const elements = sections
      .map(({ id }) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element))

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.2, 0.6] }
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [sections])

  const goToChapter = (id?: string) => {
    if (!id) return

    const target = document.getElementById(id)
    if (!target) return

    scrollWithLenis(target)
    history.replaceState(null, "", `#${id}`)
  }

  return (
    <main className={styles.page} aria-labelledby="legal-document-title">
      <header className={styles.hero}>
        <div className={styles.heroMeta}>
          <span>{eyebrow}</span>
          <span>{code}</span>
        </div>

        <div className={styles.heroGrid}>
          <div className={styles.heroTitle}>
            <p>Keramická zahrada · Písek</p>
            <h1 id="legal-document-title">{title}</h1>
            <em>{accent}</em>
          </div>

          <div className={styles.heroIntro}>
            <span>Dokument</span>
            <p>{description}</p>
            <div>
              <small>{updated}</small>
              <small>{sections.length} kapitol</small>
            </div>
          </div>
        </div>

        <div className={styles.continue}>
          <WebButton
            Kind="Button"
            title="Číst dokument"
            onClickAction={() => goToChapter(sections[0]?.id)}
          />
        </div>
      </header>

      <div className={styles.document}>
        <aside className={styles.index} aria-label="Obsah dokumentu">
          <div className={styles.indexHeading}>
            <span>Obsah</span>
            <span>{String(sections.length).padStart(2, "0")}</span>
          </div>

          <ol>
            {sections.map((section, index) => {
              const isActive = section.id === activeId
              return (
                <li key={section.id} data-active={isActive}>
                  <button
                    type="button"
                    aria-current={isActive ? "location" : undefined}
                    onClick={() => goToChapter(section.id)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{section.title}</strong>
                    <i aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        <article className={styles.content}>
          <div className={styles.contentHeader}>
            <span>{code}</span>
            <span>České znění</span>
          </div>

          {sections.map((section, index) => (
            <Chapter
              key={section.id}
              section={section}
              index={index}
              supplement={supplements?.[section.id]}
            />
          ))}

          <div className={styles.documentEnd} aria-hidden="true">
            <span />
            <i>●</i>
            <span />
          </div>
        </article>

        <aside className={styles.status} aria-hidden="true">
          <span>Dokument</span>
          <strong>{code}</strong>
          <i />
          <small>Keramická zahrada</small>
        </aside>
      </div>
    </main>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: 0.72, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
const transition2 = { duration: 0.9, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
