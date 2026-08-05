"use client"

import { AnimatePresence, motion } from "framer-motion"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useId, useState } from "react"
import { createPortal } from "react-dom"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useContactDialog } from "@modules/layout/ContactDialog"
import { easeReveal } from "@lib/motion-tokens"

import styles from "./style.module.scss"

/**
 * The links only. Search and the Produkty menu keep their own buttons in the bar, because both
 * are shortcuts people reach for directly — burying them behind a menu would cost a tap on the
 * two things the shop is actually for.
 *
 * Kontakt is not a route: it opens the site-wide contact dialog (D-S5), so it is a button here.
 */
const LINKS = [
  { label: "Výroba", href: "/vyroba" },
  { label: "Kurzy", href: "/kurzy" },
  { label: "Dotazy", href: "/dotazy" },
  { label: "O mně", href: "/o-mne" },
] as const

const backdrop = { opacity: 0 }
const backdropIn = { opacity: 1 }
const backdropTransition = { duration: 0.28 }

const panel = { opacity: 0, y: -12, clipPath: "inset(0 0 100% 0)" }
const panelIn = { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }
const panelTransition = { duration: 0.42, ease: easeReveal }

const listVariants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.1, staggerChildren: 0.05 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeReveal } },
}

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const panelId = useId()
  const contact = useContactDialog()

  const close = useCallback(() => setIsOpen(false), [])

  // Following a link navigates the page behind the overlay; it must not stay open over the
  // route it just left.
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)

    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={isOpen ? "Zavřít nabídku" : "Otevřít nabídku"}
        onClick={() => setIsOpen((open) => !open)}
        data-open={isOpen || undefined}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              /* data-lenis-prevent: Lenis handles the wheel on a document-level listener and
                 scrolls programmatically, so body{overflow:hidden} alone does not stop the page
                 drifting behind an open overlay. */
              <motion.div
                className={styles.root}
                data-lenis-prevent
                initial={backdrop}
                animate={backdropIn}
                exit={backdrop}
                transition={backdropTransition}
              >
                <button
                  type="button"
                  className={styles.backdrop}
                  aria-label="Zavřít nabídku"
                  onClick={close}
                />
                <motion.nav
                  id={panelId}
                  className={styles.panel}
                  initial={panel}
                  animate={panelIn}
                  exit={panel}
                  transition={panelTransition}
                  aria-label="Hlavní nabídka"
                >
                  <motion.ul
                    className={styles.list}
                    variants={listVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {LINKS.map((link) => (
                      <motion.li key={link.href} variants={itemVariants}>
                        <LocalizedClientLink href={link.href} onClick={close}>
                          {link.label}
                        </LocalizedClientLink>
                      </motion.li>
                    ))}
                    <motion.li variants={itemVariants}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false)
                          contact.open()
                        }}
                      >
                        Kontakt
                      </button>
                    </motion.li>
                  </motion.ul>
                </motion.nav>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
