"use client"

import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { useCallback, useEffect, useId, useRef, useState } from "react"

import { forgetLastPaymentMethod } from "@lib/util/payment-preference"
import {
  ACCEPT_ALL,
  currentChoice,
  DENY_ALL,
  readConsent,
  registerPreferencesHost,
  saveConsent,
  type ConsentChoice,
} from "@lib/util/cookie-consent"

import PreferencesDialog from "./preferences-dialog"
import { noticeVariants } from "./motion"
import styles from "./style.module.scss"

import { useSiteReducedMotion } from "@lib/context/MotionPreferenceProvider"

/**
 * Odkaz na stránku Cookies i tam, kde v adrese není kód země (kořenová 404) — middleware
 * pak sám přesměruje na správný region.
 */
export function useCookiesPageHref(): string {
  const params = useParams<{ countryCode?: string }>()
  const countryCode = typeof params?.countryCode === "string" ? params.countryCode : ""

  return countryCode ? `/${countryCode}/cookies` : "/cookies"
}

/**
 * Lišta souhlasu s cookies.
 *
 * Připojená JEDNOU v kořenovém layoutu (`app/layout.tsx`), takže je na každé stránce webu —
 * v obchodě, v pokladně i v rychlém nákupu — a „Nastavení cookies" z patičky ji otevře
 * odkudkoli. Vynechává jen Studio (redakce webu), kde žádná patička není.
 *
 * Tři rovnocenné odpovědi (14. 10. 2026, LEGAL_AUDIT.md § 8): „Odmítnout vše", „Nastavení",
 * „Přijmout vše". Stejná velikost, stejné písmo, stejný vzhled — odmítnutí, které je méně
 * vidět než souhlas, je přesně ten temný vzor, na který míří § 89 odst. 3 zákona 127/2005 Sb.
 * a pokyny EDPB. Dřívější „Přijmout jen důležité" zmizelo: tvářilo se jako odmítnutí, ale
 * zapínalo preferenční cookies.
 *
 * There is no close button. Dismissing the banner without answering would leave the visitor in the
 * deny-by-default state while implying a choice was made; the banner is non-blocking instead — it
 * sits in a corner, the page behind it works, and it waits.
 */
export default function CookieNotice() {
  const pathname = usePathname() || "/"

  // Studio je aplikace pro redakci, ne stránka obchodu: nemá patičku, nic v něm neměříme.
  if (pathname === "/studio" || pathname.startsWith("/studio/")) {
    return null
  }

  return <CookieConsentGate />
}

function CookieConsentGate() {
  const [visible, setVisible] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [choice, setChoice] = useState<ConsentChoice>(DENY_ALL)
  const reduceMotion = useSiteReducedMotion()
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const cookiesHref = useCookiesPageHref()
  const textId = useId()

  // Read after mount: the server cannot know what this visitor has already decided.
  useEffect(() => {
    setChoice(currentChoice())
    setVisible(readConsent() === null)
  }, [])

  // The footer link and the cookies page reopen the settings through `openCookiePreferences()` —
  // consent has to be as easy to take back as it was to give, and that means from outside a banner
  // that is long gone.
  useEffect(
    () =>
      registerPreferencesHost(() => {
        returnFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        setChoice(currentChoice())
        setDialogOpen(true)
      }),
    []
  )

  /* Hand the focus back to whatever opened the dialog, so a keyboard visitor resumes where they
     were instead of at the top of the page. The `isConnected` guard covers the trigger that is no
     longer in the document — the banner's own „Nastavení" after the banner has been answered. */
  const releaseFocus = useCallback(() => {
    const trigger = returnFocusRef.current

    returnFocusRef.current = null

    if (trigger?.isConnected) {
      trigger.focus()
    }
  }, [])

  const persist = useCallback(
    (next: ConsentChoice) => {
      // Uloží souhlas a vyšle `kz:cookie-consent` — analytika (`modules/analytics`) na ni
      // reaguje sama: načte, nebo vypne Google Analytics a smaže jeho cookies.
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
    setChoice(currentChoice())
    setDialogOpen(true)
  }

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.aside
            className={styles.root}
            /* Jméno oblasti pro odečítače; nadpis by se v DOM ocitl před <h1> stránky. */
            aria-label="Souhlas s cookies"
            aria-describedby={textId}
            /* Karta se dá posouvat sama (overflow-y), Lenis jí kolečko nesmí brát. */
            data-lenis-prevent
            variants={noticeVariants}
            initial={reduceMotion ? "visible" : "hidden"}
            animate="visible"
            exit="exit"
          >
            <p id={textId} className={styles.text}>
              Nezbytné cookies
              <span className={styles.detail}> — košík, přihlášení, objednávka —</span>{" "}
              běží vždy, bez nich obchod nefunguje. Ostatní (zapamatování vašich
              voleb, měření návštěvnosti, mapa Google) zapneme jen s vaším
              souhlasem. Rozhodnutí můžete kdykoli změnit v patičce webu.{" "}
              <Link href={cookiesHref} className={styles.link}>
                Více o cookies
              </Link>
            </p>
            {/* Pořadí v DOM = pořadí na obrazovce = pořadí Tabu (WCAG 2.4.3). Na telefonu
                „Nastavení" přes celou šířku nahoře, pod ním odmítnutí a souhlas vedle sebe. */}
            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.button} ${styles.settings}`}
                onClick={openDialog}
                aria-haspopup="dialog"
              >
                Nastavení
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => persist(DENY_ALL)}
              >
                Odmítnout vše
              </button>
              <button
                type="button"
                className={styles.button}
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
            cookiesHref={cookiesHref}
            onSave={persist}
            onClose={closeDialog}
          />
        )}
      </AnimatePresence>
    </>
  )
}
