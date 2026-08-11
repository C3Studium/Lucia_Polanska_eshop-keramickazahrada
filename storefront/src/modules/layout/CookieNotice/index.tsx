"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { noticeVariants } from "./motion"
import styles from "./style.module.scss"

const STORAGE_KEY = "kz-cookie-notice-acknowledged"

/**
 * An informational notice, not a consent gate.
 *
 * The storefront runs no third-party trackers — only the cookies the shop needs to work (cart,
 * session, region choice). There is nothing to withhold pending consent, so asking for it would
 * be theatre: the notice says what is stored, links to the detail, and goes away when
 * acknowledged. If a tracker is ever added, this has to become a real consent manager.
 */
export default function CookieNotice() {
  const [visible, setVisible] = useState(false)
  const reduceMotion = useReducedMotion()

  // Read after mount: the server cannot know what this visitor has already acknowledged.
  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== "1")
    } catch {
      // Private browsing can refuse storage; showing it once per visit is acceptable.
      setVisible(true)
    }
  }, [])

  const acknowledge = () => {
    setVisible(false)

    try {
      window.localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // Nothing to do — the notice simply reappears on the next visit.
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          className={styles.root}
          aria-label="Informace o cookies"
          variants={noticeVariants}
          initial={reduceMotion ? "visible" : "hidden"}
          animate="visible"
          exit="exit"
        >
          <p className={styles.text}>
            Používáme jen cookies, bez kterých by obchod nefungoval — košík,
            přihlášení a volba země. Nesledujeme vás a nikomu nic nepředáváme.{" "}
            <LocalizedClientLink href="/cookies" className={styles.link}>
              Více o cookies
            </LocalizedClientLink>
          </p>
          <button type="button" className={styles.button} onClick={acknowledge}>
            Rozumím
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
