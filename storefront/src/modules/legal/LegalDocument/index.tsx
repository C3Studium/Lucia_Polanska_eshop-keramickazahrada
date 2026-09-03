"use client"

import { editable } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import type { CopyBlock } from "@lib/util/site-copy"
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
  /** Znění zabudované v kódu — záloha pro výpadek CMS. */
  sections: LegalSectionData[]
  /**
   * Blok `<stránka>.text` z CMS. Nese nadpisy, odstavce a odrážky kapitol
   * v pořadí, v jakém stojí v `sections`.
   */
  block?: CopyBlock
  /**
   * Dokumenty ke stažení pod poslední kapitolou.
   *
   * Slot, ne komponenta vykreslená za `<LegalDocument>`: ta vrací `<main>`,
   * takže seznam za ní by skončil mimo hlavní obsah stránky — pro odečítač
   * obrazovky i pro osnovu dokumentu je to jiné místo, než kam patří.
   */
  downloads?: ReactNode
  supplements?: Record<string, ReactNode>
}

function Chapter({
  section,
  index,
  supplement,
  editTitle,
  editBody,
}: {
  section: LegalSectionData
  index: number
  supplement?: ReactNode
  /** Atributy překryvu pro nadpis kapitoly a její text. Mimo náhled prázdné. */
  editTitle?: Record<string, string | undefined>
  editBody?: Record<string, string | undefined>
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
        <h2 id={`${section.id}-title`} {...editTitle}>{section.title}</h2>
      </div>

      {/* Překryv sedí na celém těle kapitoly, ne na jednotlivých odstavcích:
          v CMS je to jedno pole, kde odstavce dělí prázdný řádek. Anotovat
          každý `<p>` zvlášť by nabízelo úpravu něčeho, co samostatně
          uloženo není. */}
      <div className={styles.chapterBody} {...editBody}>
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
  sections: fallbackSections,
  downloads,
  block,
  supplements,
}: LegalDocumentProps) {
  /* Stránka se po zapnutí režimu editace sama nepřekreslí — viz hook. */
  useEditRerender()

  /*
   * Okolní texty stránky z CMS, s hodnotami z kódu jako zálohou.
   *
   * Jsou v témže bloku jako kapitoly (`<stránka>.text`), ne ve druhém: redaktor otevře
   * jeden dokument a má v něm celou stránku. Fungují tím pro všech šest právních stránek
   * naráz — komponent je jeden.
   */
  /* `accent` má ve schématu strop ŠESTI položek — víc by Studio odmítlo uložit.
     Slova „kapitol" a „Obsah" proto zůstávají v kódu; jsou to obecné popisky
     rozhraní, ne texty stránky. */
  const eyebrowText = block?.accent?.[0]?.trim() || eyebrow
  const codeText = block?.accent?.[1]?.trim() || code
  const ownerText = block?.accent?.[2]?.trim() || "Keramická zahrada · Písek"
  const documentLabel = block?.accent?.[3]?.trim() || "Dokument"
  const updatedText = block?.accent?.[4]?.trim() || updated
  const ctaText = block?.accent?.[5]?.trim() || "Číst dokument"
  const chaptersWord = "kapitol"
  const indexHeading = "Obsah"
  const titleText = block?.title?.trim() || title
  const accentText = block?.headline?.trim() || accent
  const descriptionText = block?.bodyText?.trim() || description

  /*
   * Znění z CMS, struktura z kódu.
   *
   * `id` se z bloku NEČTE, i když v něm (jako `lead`) je: visí na něm kotva
   * v adrese, boční navigace a `aria-labelledby`. Odkaz, který si někdo
   * uložil nebo poslal v e-mailu, nesmí přestat platit tím, že redaktor
   * přepsal nadpis kapitoly.
   *
   * Sekce, kterou blok nemá, si nechá znění z kódu — dokument se tak nikdy
   * nezkrátí ani nezprázdní, ať je v CMS cokoliv. U právního textu je to
   * podstatnější než jinde: chybějící odstavec obchodních podmínek není
   * kosmetická vada.
   */
  const sections = fallbackSections.map((section, index) => {
    const item = block?.items?.[index]
    if (!item) return section
    const paragraphs = (item.value ?? "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
    const bullets = (item.note ?? "")
      .split(/\n+/)
      .map((b) => b.trim())
      .filter(Boolean)
    return {
      ...section,
      title: item.label?.trim() || section.title,
      paragraphs: paragraphs.length ? paragraphs : section.paragraphs,
      bullets: bullets.length ? bullets : section.bullets,
    }
  })

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
          <span {...editable(block, "accent.0")}>{eyebrowText}</span>
          <span {...editable(block, "accent.1")}>{codeText}</span>
        </div>

        <div className={styles.heroGrid}>
          <div className={styles.heroTitle}>
            <p {...editable(block, "accent.2")}>{ownerText}</p>
            <h1 id="legal-document-title" {...editable(block, "title")}>
              {titleText}
            </h1>
            <em {...editable(block, "headline")}>{accentText}</em>
          </div>

          <div className={styles.heroIntro}>
            <span {...editable(block, "accent.3")}>{documentLabel}</span>
            <p {...editable(block, "body")}>{descriptionText}</p>
            <div>
              <small {...editable(block, "accent.4")}>{updatedText}</small>
              {/* Počet kapitol se počítá; slovo za ním je v kódu (strop accent). */}
              <small>
                {sections.length} {chaptersWord}
              </small>
            </div>
          </div>
        </div>

        <div className={styles.continue}>
          {/* Obal, ne `WebButton`: ten si vykresluje vlastní vnitřek a datové atributy
              by skončily na prvku, který se při animaci přepisuje. */}
          <span {...editable(block, "accent.5")}>
            <WebButton
              Kind="Button"
              title={ctaText}
              onClickAction={() => goToChapter(sections[0]?.id)}
            />
          </span>
        </div>
      </header>

      <div className={styles.document}>
        {/* data-lenis-prevent: v boční podobě má rejstřík max-height 100vh minus lepicí
            odsazení, takže je to skutečný scroll kontejner — na 1280x720 zbývá 570px na
            seznam, který na /smluvni-podminky přeteče. Bez toho Lenis spolkne wheel nad
            seznamem a odroluje stránku místo něj. */}
        <aside className={styles.index} aria-label="Obsah dokumentu" data-lenis-prevent>
          <div className={styles.indexHeading}>
            {/* Názvy položek pod tím jsou `section.title`, tedy popisky kapitol z CMS —
                přejmenovaná kapitola se v rejstříku přejmenuje sama. Kotva zůstává, ta
                visí na `id` z kódu, aby uložený odkaz nepřestal platit. */}
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
            <span>{code}</span>
            <span>České znění</span>
          </div>

          {sections.map((section, index) => (
            <Chapter
              key={section.id}
              section={section}
              index={index}
              supplement={supplements?.[section.id]}
              editTitle={editable(block, `items.${index}.label`)}
              editBody={editable(block, `items.${index}.value`)}
            />
          ))}

          {downloads}

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
