"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { useEffect, useId, useRef, useState } from "react"

import {
  ACCEPT_ALL,
  DENY_ALL,
  type ConsentChoice,
  type OptionalCategory,
} from "@lib/util/cookie-consent"

import { consentCategories } from "./categories"
import { dialogBackdropVariants, dialogPanelVariants } from "./motion"
import styles from "./dialog.module.scss"

import { useSiteReducedMotion } from "@lib/context/MotionPreferenceProvider"
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

type PreferencesDialogProps = {
  initial: ConsentChoice
  /** Odkaz na stránku Cookies s kódem země (viz `useCookiesPageHref`). */
  cookiesHref: string
  onSave: (choice: ConsentChoice) => void
  onClose: () => void
}

/**
 * „Nastavení" — přepínače po kategoriích.
 *
 * The switches edit a draft, not the stored decision. Nothing is written until one of the three
 * decisions at the bottom; Escape, the backdrop and the close button all discard the draft and
 * leave whatever was stored before exactly as it was — including "nothing", in which case the
 * banner is still waiting underneath. A dialog that saved as you toggled would mean a visitor who
 * opened it to look, and closed it again, had consented by browsing.
 *
 * Dole tři rovnocenná rozhodnutí: „Odmítnout vše", „Uložit výběr", „Přijmout vše". Odvolat
 * souhlas z patičky tak jde dvěma kliky (Nastavení cookies → Odmítnout vše) — stejně snadno,
 * jako se dal udělit. Nic není předem zapnuté: bez uloženého rozhodnutí je návrh `DENY_ALL`.
 */
export default function PreferencesDialog({
  initial,
  cookiesHref,
  onSave,
  onClose,
}: PreferencesDialogProps) {
  const [draft, setDraft] = useState<ConsentChoice>(initial)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const reduceMotion = useSiteReducedMotion()
  const titleId = useId()
  const descriptionId = useId()
  const rowId = useId()

  // Escape closes; Tab cycles inside the dialog rather than escaping to the page behind it.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
        return
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((element) => element.offsetParent !== null)

      if (!focusable.length) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (
        event.shiftKey &&
        (active === first || !panelRef.current.contains(active))
      ) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 160)

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  const toggle = (category: OptionalCategory) =>
    setDraft((current) => ({ ...current, [category]: !current[category] }))

  return (
    <motion.div
      className={styles.backdrop}
      /* Seznam kategorií se posouvá sám; Lenis mu kolečko nesmí brát. */
      data-lenis-prevent
      variants={dialogBackdropVariants}
      initial={reduceMotion ? "visible" : "hidden"}
      animate="visible"
      exit="exit"
      onMouseDown={(event) => {
        // Only a press that both starts and ends on the backdrop closes — a drag that began on a
        // switch and released outside must not be read as "dismiss".
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <motion.div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        variants={dialogPanelVariants}
        initial={reduceMotion ? "visible" : "hidden"}
        animate="visible"
        exit="exit"
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Cookies</p>
            <h2 id={titleId} className={styles.title}>
              Nastavení cookies
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Zavřít bez uložení"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <p id={descriptionId} className={styles.lede}>
          Vyberte, co smíme ukládat. Bez vašeho souhlasu běží jen nezbytné
          cookies. Rozhodnutí můžete kdykoli změnit odkazem „Nastavení cookies“
          v patičce.{" "}
          <Link href={cookiesHref} className={styles.link}>
            Seznam všech cookies
          </Link>
        </p>

        <ul className={styles.categories}>
          {consentCategories.map((category, index) => {
            const key = category.key
            const checked = key === null ? true : draft[key]
            const labelId = `${rowId}-${index}-title`
            const textId = `${rowId}-${index}-text`

            return (
              <li key={category.title} className={styles.category}>
                <label className={styles.categoryLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={checked}
                    disabled={key === null}
                    aria-labelledby={labelId}
                    aria-describedby={textId}
                    onChange={() => key && toggle(key)}
                  />
                  <span className={styles.switch} aria-hidden="true">
                    <span className={styles.switchKnob} />
                  </span>
                  <span className={styles.categoryText}>
                    <span className={styles.categoryTitle}>
                      <span id={labelId}>{category.title}</span>
                      {key === null && (
                        <span className={styles.badge}>Vždy aktivní</span>
                      )}
                    </span>
                    <span id={textId} className={styles.categoryDescription}>
                      {category.description}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        {/* Tři rovnocenná rozhodnutí — stejná velikost i vzhled. Pořadí v DOM odpovídá
            pořadí na obrazovce i Tabu. */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.button}
            onClick={() => onSave(DENY_ALL)}
          >
            Odmítnout vše
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => onSave(draft)}
          >
            Uložit výběr
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => onSave(ACCEPT_ALL)}
          >
            Přijmout vše
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
