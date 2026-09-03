"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useParams, usePathname } from "next/navigation"
import { useCallback, useEffect, useId } from "react"
import { createPortal } from "react-dom"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useContactDialog } from "@modules/layout/ContactDialog"
import { easeReveal } from "@lib/motion-tokens"
import { editable } from "@c3studium/valecms/edit"
import { button } from "@lib/util/site-copy"
import type { CopyButton } from "@lib/util/site-copy"

import styles from "./style.module.scss"

/**
 * The links only. Search and the Produkty menu keep their own buttons in the bar, because both
 * are shortcuts people reach for directly — burying them behind a menu would cost a tap on the
 * two things the shop is actually for.
 *
 * Úvod is here because the phone bar no longer carries the wordmark: at 360px the bar could not
 * hold a brand link, a search that opens to a real input, the E-shop button and a menu toggle at
 * the 44px floor, and of those four the brand link is the one with a home everywhere else — this
 * menu, the footer logo, and every logo convention a visitor already knows.
 *
 * Kontakt is not a route: it opens the site-wide contact dialog (D-S5), so it is a button here.
 */
/*
 * `cms` je klíč záznamu v CMS, `label` záloha pro výpadek — a zároveň to,
 * z čeho vznikl výchozí obsah (scripts/seed-buttons.mjs).
 *
 * Adresa v CMS není a nebude: všechno tu vede dovnitř webu, takže cíl je
 * routa téhle aplikace. Kdyby šla měnit v CMS, stačil by jeden překlep
 * k odkazu, který nikam nevede — a projevil by se až návštěvníkovi.
 */
const LINKS = [
  { label: "Úvod", href: "/", cms: "menu.uvod" },
  { label: "Výroba", href: "/vyroba", cms: "menu.vyroba" },
  { label: "Kurzy", href: "/kurzy", cms: "menu.kurzy" },
  { label: "Dotazy", href: "/dotazy", cms: "menu.dotazy" },
  { label: "O mně", href: "/o-mne", cms: "menu.o-mne" },
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

type MobileNavProps = {
  isOpen: boolean
  onOpenChange: (next: boolean) => void
  /** Názvy položek z CMS. Adresy zůstávají v kódu — všechny vedou dovnitř webu. */
  buttons?: Record<string, CopyButton>
}

/**
 * Controlled, rather than owning its own open state.
 *
 * The bar has three things that cover the page — this menu, the E-shop menu and the search panel
 * — and only one of them can be the answer to a tap. While this component held its own state the
 * Navbar could not know it was open, so opening the E-shop menu left the menu underneath it and
 * the two overlays stacked. One owner for all three settles it.
 */
export default function MobileNav({
  isOpen,
  onOpenChange,
  buttons,
}: MobileNavProps) {
  const panelId = useId()
  const contact = useContactDialog()
  const pathname = usePathname()
  const { countryCode } = useParams<{ countryCode: string }>()

  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  /** What `LocalizedClientLink` will actually navigate to, so the comparison is like for like. */
  const localised = useCallback(
    (href: string) => `/${countryCode}${href === "/" ? "" : href}`,
    [countryCode]
  )

  /*
   * Close, and put the reader at the top of what they picked.
   *
   * Two reasons this is not left to the browser. Following a link to the route you are already on
   * is a no-op for the router, so the menu would close over an unchanged page — tapping „Kurzy"
   * from halfway down Kurzy should still take you to the top of it. And on a route change Lenis
   * holds its own scroll position, so the new page can arrive already scrolled.
   *
   * `window.lenis` when it is running, native otherwise: Lenis is skipped on touch, which is
   * exactly where this menu lives, so the native path is the one that normally runs.
   */
  const follow = useCallback(
    (isCurrent: boolean) => {
      close()

      if (typeof window === "undefined") return

      const toTop = () => {
        const lenis = (window as unknown as { lenis?: { scrollTo: Function } }).lenis

        if (lenis) {
          lenis.scrollTo(0, { immediate: !isCurrent })
          return
        }

        window.scrollTo({ top: 0, behavior: isCurrent ? "smooth" : "auto" })
      }

      /* A route change scrolls after the new page commits; staying put can scroll now. */
      if (isCurrent) {
        toTop()
      } else {
        window.requestAnimationFrame(toTop)
      }
    },
    [close]
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close()
      }
    }

    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)

    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [isOpen, close])

  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={isOpen ? "Zavřít nabídku" : "Otevřít nabídku"}
        onClick={() => onOpenChange(!isOpen)}
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
                    {LINKS.map((link) => {
                      const isCurrent = pathname === localised(link.href)
                      const cms = button(buttons, link.cms)

                      return (
                        <motion.li key={link.href} variants={itemVariants}>
                          <LocalizedClientLink
                            href={link.href}
                            onClick={() => follow(isCurrent)}
                            data-current={isCurrent || undefined}
                            /* The styling marks it, but a screen reader needs telling too — and
                               `page` rather than `true`, since this is a location, not a state. */
                            aria-current={isCurrent ? "page" : undefined}
                            {...editable(cms, "label")}
                          >
                            {cms?.label?.trim() || link.label}
                          </LocalizedClientLink>
                        </motion.li>
                      )
                    })}
                    <motion.li variants={itemVariants}>
                      {/* Kontakt není routa — otevírá dialog —, ale název se
                          mění stejně jako u ostatních položek nabídky. */}
                      <button
                        type="button"
                        onClick={() => {
                          close()
                          contact.open()
                        }}
                        {...editable(button(buttons, "menu.kontakt"), "label")}
                      >
                        {button(buttons, "menu.kontakt")?.label?.trim() || "Kontakt"}
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
