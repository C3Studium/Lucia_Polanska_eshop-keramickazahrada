"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useCallback, useEffect, useRef, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { forgetLastPaymentMethod } from "@lib/util/payment-preference"
import {
  ACCEPT_ALL,
  CONSENT_OPEN_EVENT,
  currentChoice,
  DENY_ALL,
  ESSENTIAL_ONLY,
  readConsent,
  saveConsent,
  type ConsentChoice,
} from "@lib/util/cookie-consent"

import PreferencesDialog from "./preferences-dialog"
import { noticeVariants } from "./motion"
import styles from "./style.module.scss"

/**
 * The consent gate.
 *
 * It was an informational notice with a single „Rozumím" — true while the shop set nothing but
 * cart, session and region cookies, but not a lawful basis for anything else, and the cookies page
 * already describes analytics and third-party categories. So it is now a real decision: four
 * answers on the banner, per-category switches behind „Upravit", and nothing optional runs until
 * one of them is given.
 *
 * The three accept/reject actions each map to a distinct stored state — „Zamítnout" grants nothing,
 * „Přijmout jen důležité" grants the preference cookies that remember the visitor's own choices,
 * „Přijmout vše" grants everything. They are the same size and weight on purpose: a reject that is
 * quieter than the accept is the dark pattern the regulation is aimed at.
 *
 * There is no close button. Dismissing the banner without answering would leave the visitor in the
 * deny-by-default state while implying a choice was made; the banner is non-blocking instead — it
 * sits in a corner, the page behind it works, and it waits.
 */
export default function CookieNotice() {
  const [visible, setVisible] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [choice, setChoice] = useState<ConsentChoice>(DENY_ALL)
  const reduceMotion = useReducedMotion()
  const returnFocusRef = useRef<HTMLElement | null>(null)

  // Read after mount: the server cannot know what this visitor has already decided.
  useEffect(() => {
    setChoice(currentChoice())
    setVisible(readConsent() === null)
  }, [])

  // The footer link and the cookies page reopen the settings through this event — consent has to be
  // as easy to take back as it was to give, and that means from outside a banner that is long gone.
  useEffect(() => {
    const open = () => {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      setChoice(currentChoice())
      setDialogOpen(true)
    }

    window.addEventListener(CONSENT_OPEN_EVENT, open)

    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open)
  }, [])

  /* Hand the focus back to whatever opened the dialog, so a keyboard visitor resumes where they
     were instead of at the top of the page. The `isConnected` guard covers the trigger that is no
     longer in the document — the banner's own „Upravit" after the banner has been answered. */
  const releaseFocus = useCallback(() => {
    const trigger = returnFocusRef.current

    returnFocusRef.current = null

    if (trigger?.isConnected) {
      trigger.focus()
    }
  }, [])

  const persist = useCallback(
    (next: ConsentChoice) => {
      saveConsent(next)

      // Withdrawing a category has to remove what it stored, not merely stop adding to it.
      if (!next.preferences) {
        forgetLastPaymentMethod()
      }

      setChoice(next)
      setVisible(false)
      setDialogOpen(false)
      releaseFocus()
    },
    [releaseFocus]
  )

  const closeDialog = useCallback(() => {
    // Closing without saving changes nothing: the previous decision stands, and if there was none
    // the banner is still waiting underneath.
    setDialogOpen(false)
    releaseFocus()
  }, [releaseFocus])

  const openDialog = (event: React.MouseEvent<HTMLButtonElement>) => {
    returnFocusRef.current = event.currentTarget
    setDialogOpen(true)
  }

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.aside
            className={styles.root}
            aria-label="Nastavení cookies"
            variants={noticeVariants}
            initial={reduceMotion ? "visible" : "hidden"}
            animate="visible"
            exit="exit"
          >
            <p className={styles.text}>
              Nezbytné cookies
              <span className={styles.detail}>
                {" "}
                — košík, přihlášení a volba země —
              </span>{" "}
              běží vždy, bez nich obchod nefunguje. O preferenčních,
              analytických a marketingových rozhodujete vy.{" "}
              <LocalizedClientLink href="/cookies" className={styles.link}>
                Více o cookies
              </LocalizedClientLink>
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.buttonGhost}
                onClick={openDialog}
              >
                Upravit
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => persist(DENY_ALL)}
              >
                Zamítnout
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => persist(ESSENTIAL_ONLY)}
              >
                Přijmout jen důležité
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={() => persist(ACCEPT_ALL)}
              >
                Přijmout vše
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dialogOpen && (
          <PreferencesDialog
            initial={choice}
            onSave={persist}
            onClose={closeDialog}
          />
        )}
      </AnimatePresence>
    </>
  )
}
