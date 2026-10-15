"use client"

import { renderInline } from "@lib/legal/inline"
import type { LegalBlock, LegalDocumentVersion, LegalSection } from "@lib/legal/types"
import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import WebButton from "@modules/common/components/Buttons/webButton"
import LegalDownloads, { type LegalDownloadItem } from "@modules/legal/Downloads"
import { motion, useInView } from "framer-motion"
import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import styles from "./style.module.scss"

/*
 * Právní dokument z registru (`@lib/legal`), ne z CMS.
 *
 * Dřív tu znění kapitol přepisoval blok `<stránka>.text` z ValeCMS podle
 * pořadí kapitol (a hero `accent[4]` přepisoval i „Platné od"). U právního
 * textu to nejde: znění se váže k objednávce (verze OP v `order.metadata`),
 * generuje se z něj PDF a čte ho advokát v PR — CMS by na webu ukázal jiné
 * znění, než jaké zákazník dostal v e-mailu, a pole má strop 1000 znaků.
 * Proto se dokument bere jen z registru a CMS je u právních stránek vypnuté
 * celé, včetně hero textů (název a datum účinnosti musí sedět s verzí).
 *
 * Komponenta je klientská jen kvůli animacím a sledování aktivní kapitoly.
 * Registr sem neimportuje — stránka (`LegalPage`, server) spočítá verze,
 * upozornění a PDF a pošle hotová data, aby se do prohlížeče netahaly texty
 * všech dokumentů.
 */

/** Popisky hero, které nejsou součástí znění dokumentu (vizuální kód stránky). */
export type LegalPresentation = {
  /** Kód v rohu, např. „01" nebo „GDPR · 02". */
  code: string
  /** Štítek nad hero, např. „Pravidla nákupu". */
  eyebrow: string
  /** Kurzivní doplněk pod nadpisem, např. „Bez drobného písma.". */
  accent: string
}

export type LegalNotice = {
  tone: "upcoming" | "archive" | "future"
  text: string
  link?: { href: string; label: string }
}

export type LegalVersionLink = {
  href: string
  title: string
  description?: string
}

export type LegalPdfLink = {
  href: string
  fileName: string
  bytes: number
}

type LegalDocumentProps = {
  doc: LegalDocumentVersion
  presentation: LegalPresentation
  /** „Platné od 15. 10. 2026" — spočítané na serveru z verze. */
  effectiveLabel: string
  /** Prefix země pro interní odkazy v textu (`/cz/...`). */
  countryCode: string
  notices?: LegalNotice[]
  pdf?: LegalPdfLink | null
  /** Další znění téhož dokumentu (archivní / připravované). */
  versions?: LegalVersionLink[]
  /**
   * Obsah, který k textu kapitoly přidává stránka (např. živý ceník dopravy).
   * Klíč = `id` kapitoly; vykreslí se na konci jejího těla.
   */
  supplements?: Record<string, ReactNode>
}

type InlineRenderer = (text: string) => ReactNode[]

function Blocks({ blocks, inline }: { blocks: LegalBlock[]; inline: InlineRenderer }) {
  return (
    <>
      {blocks.map((block, index) => (
        <Block key={index} block={block} inline={inline} />
      ))}
    </>
  )
}

function Block({ block, inline }: { block: LegalBlock; inline: InlineRenderer }) {
  switch (block.type) {
    case "p":
      return <p>{inline(block.text)}</p>
    case "ul":
      return (
        <ul>
          {block.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ul>
      )
    case "ol":
      return (
        <ol>
          {block.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ol>
      )
    case "table":
      return (
        /* Široká tabulka se na telefonu posouvá do strany sama, ne celá
           stránka; region s popiskem a tabIndex, aby šla posunout i
           klávesnicí a odečítač věděl, co posouvá. */
        <div
          className={styles.tableScroll}
          role="region"
          aria-label={block.caption ?? "Tabulka"}
          tabIndex={0}
        >
          <table className={styles.table}>
            {block.caption ? <caption>{inline(block.caption)}</caption> : null}
            <thead>
              <tr>
                {block.head.map((cell, index) => (
                  <th key={index} scope="col">
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) =>
                    cellIndex === 0 ? (
                      <th key={cellIndex} scope="row">
                        {inline(cell)}
                      </th>
                    ) : (
                      <td key={cellIndex}>{inline(cell)}</td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case "box":
      return (
        <div className={styles.box} role="note">
          {block.title ? <h3 className={styles.boxTitle}>{inline(block.title)}</h3> : null}
          <Blocks blocks={block.blocks} inline={inline} />
        </div>
      )
    case "form":
      return (
        <div className={styles.form}>
          {block.title ? <h3 className={styles.formTitle}>{inline(block.title)}</h3> : null}
          <dl className={styles.formFields}>
            {block.fields.map((field, index) => (
              <div key={index} className={styles.formRow}>
                <dt>{inline(field.label)}</dt>
                {field.value ? (
                  <dd>{inline(field.value)}</dd>
                ) : (
                  /* Prázdné místo k ručnímu vyplnění po vytištění. */
                  <dd className={styles.formBlank}>
                    <span className={styles.visuallyHidden}>(vyplňte)</span>
                  </dd>
                )}
              </div>
            ))}
          </dl>
          {block.note ? <p className={styles.formNote}>{inline(block.note)}</p> : null}
        </div>
      )
  }
}

function Chapter({
  section,
  index,
  supplement,
  inline,
}: {
  section: LegalSection
  index: number
  supplement?: ReactNode
  inline: InlineRenderer
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
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0.28, y: 24 }}
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
        <Blocks blocks={section.blocks} inline={inline} />
        {supplement}
      </div>
    </motion.section>
  )
}

export default function LegalDocument({
  doc,
  presentation,
  effectiveLabel,
  countryCode,
  notices = [],
  pdf = null,
  versions = [],
  supplements,
}: LegalDocumentProps) {
  const sections = doc.sections
  const chaptersWord = "kapitol"
  const indexHeading = "Obsah"

  const inline = useCallback<InlineRenderer>(
    (text) =>
      renderInline(text, {
        hrefFor: (path) => `/${countryCode}${path}`,
        placeholderClassName: styles.placeholder,
      }),
    [countryCode]
  )

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

  /* PDF z manifestu (`pnpm legal:build`), dokud neexistuje, aspoň tisk
     stránky — odkaz na soubor, který není, je horší než žádný. */
  const downloads: LegalDownloadItem[] = [
    pdf
      ? {
          kind: "pdf",
          href: pdf.href,
          title: `${doc.title} (PDF)`,
          description: effectiveLabel,
          bytes: pdf.bytes,
        }
      : {
          kind: "print",
          title: `Vytisknout ${doc.title.toLocaleLowerCase("cs")}`,
          description: "Nebo uložit jako PDF přes tisk v prohlížeči",
        },
    ...versions.map<LegalDownloadItem>((version) => ({
      kind: "link",
      href: version.href,
      title: version.title,
      description: version.description,
    })),
  ]

  return (
    <main className={styles.page} aria-labelledby="legal-document-title">
      <header className={styles.hero}>
        <div className={styles.heroMeta}>
          <span>{presentation.eyebrow}</span>
          <span>{presentation.code}</span>
        </div>

        <div className={styles.heroGrid}>
          <div className={styles.heroTitle}>
            <p>Keramická zahrada · Písek</p>
            <h1 id="legal-document-title">{doc.title}</h1>
            <em>{presentation.accent}</em>
          </div>

          <div className={styles.heroIntro}>
            <span>Dokument</span>
            {doc.summary ? <p>{inline(doc.summary)}</p> : null}
            <div>
              <small>{effectiveLabel}</small>
              <small>
                {sections.length} {chaptersWord}
              </small>
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
        {/* data-lenis-prevent: v boční podobě má rejstřík max-height 100vh minus lepicí
            odsazení, takže je to skutečný scroll kontejner — na 1280x720 zbývá 570px na
            seznam, který na /smluvni-podminky přeteče. Bez toho Lenis spolkne wheel nad
            seznamem a odroluje stránku místo něj. */}
        <aside className={styles.index} aria-label="Obsah dokumentu" data-lenis-prevent>
          <div className={styles.indexHeading}>
            <span>{indexHeading}</span>
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
            <span>{presentation.code}</span>
            <span>České znění · {effectiveLabel}</span>
          </div>

          {notices.map((notice, index) => (
            <div
              key={index}
              className={styles.notice}
              data-tone={notice.tone}
              role="note"
            >
              <p>
                {notice.text}
                {notice.link ? (
                  <>
                    {" "}
                    <a href={notice.link.href}>{notice.link.label}</a>
                  </>
                ) : null}
              </p>
            </div>
          ))}

          {sections.map((section, index) => (
            <Chapter
              key={section.id}
              section={section}
              index={index}
              supplement={supplements?.[section.id]}
              inline={inline}
            />
          ))}

          <LegalDownloads items={downloads} />

          <div className={styles.documentEnd} aria-hidden="true">
            <span />
            <i>●</i>
            <span />
          </div>
        </article>

        <aside className={styles.status} aria-hidden="true">
          <span>Dokument</span>
          <strong>{presentation.code}</strong>
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
