import { AnimatePresence, Easing, motion } from 'framer-motion';
import styles from './styles.module.scss';
import Image from 'next/image';
import { ChangeEvent, useEffect, useRef, useState } from 'react';

type SearchButtonProps = {
  isActive?: boolean
  onClick?: () => void
  onValueChange?: (value: string) => void
  value?: string
}

const ease = [0.76, 0, 0.24, 1] as Easing

/** Widest the field ever opens — beyond this it stops reading as a control in a bar. */
const MAX_OPEN_WIDTH = 420

/**
 * What the open field must leave behind on the same row: the bar's two gutters, the E-shop button
 * and the menu toggle at the 44px floor, and the gaps between them. Below ~570px of viewport this
 * is what the field is sized against instead of {@link MAX_OPEN_WIDTH}, and the E-shop button is
 * pushed right by exactly the amount the field grows rather than being painted over.
 */
const RESERVED_FOR_SIBLINGS = 148

/** Collapsed: a dense control in the desktop bar, a 44px target on a phone. */
const CLOSED_WIDTH = 36
const CLOSED_WIDTH_PHONE = 44

/** Matches the `md` stop the phone navbar layout is built on. */
const PHONE_WIDTH = 600

export default function SearchButton({
  isActive = false,
  onClick,
  onValueChange,
  value = "",
}: SearchButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  /*
   * A hard 420 here was wider than the pill it lives in on every phone: the left pill is capped
   * at 52% of the bar, so the field spilled across the E-shop button and off the right edge of a
   * 360px screen. Measured instead, and re-measured on resize and rotation.
   *
   * Starts at the maximum so the server render and the first client render agree — narrowing
   * happens in the effect, after hydration, where `window` exists.
   */
  const [openWidth, setOpenWidth] = useState(MAX_OPEN_WIDTH)

  /*
   * Closed, the control is the whole tap target, and on a phone it is the only thing in the left
   * pill — so it is a 44px circle there rather than the 36px it is in a dense desktop bar. The
   * width is an inline style from framer-motion, so CSS cannot raise it; it has to be decided
   * here, alongside the open width, off the same measurement.
   */
  const [closedWidth, setClosedWidth] = useState(CLOSED_WIDTH)

  useEffect(() => {
    const measure = () => {
      setOpenWidth(
        Math.max(180, Math.min(MAX_OPEN_WIDTH, window.innerWidth - RESERVED_FOR_SIBLINGS))
      )
      setClosedWidth(window.innerWidth <= PHONE_WIDTH ? CLOSED_WIDTH_PHONE : CLOSED_WIDTH)
    }

    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  useEffect(() => {
    if (!isActive) return

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 250)
    return () => window.clearTimeout(focusTimer)
  }, [isActive])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange?.(event.currentTarget.value)
  }

  return (
    <motion.div
      className={`${styles.searchControl} ${isActive ? styles.active : ""}`}
      initial={false}
      animate={{ width: isActive ? openWidth : closedWidth }}
      transition={transition}
      style={styleObj}
    >
      <button
        type="button"
        className={styles.button}
        aria-label={isActive ? "Zavřít vyhledávání" : "Otevřít vyhledávání"}
        aria-expanded={isActive}
        aria-controls="navbar-search"
        onClick={onClick}
      >
        <Image className={styles.searchIcon} src="/assets/icons/search.svg" alt="" width={19} height={19}/>
      </button>
      <AnimatePresence initial={false}>
        {isActive && (
          <motion.input
            ref={inputRef}
            className={styles.input}
            data-testid="navbar-search-input"
            type="search"
            value={value}
            placeholder="Vyhledat produkty…"
            aria-label="Vyhledat produkty"
            autoComplete="off"
            onChange={handleChange}
            initial={initial}
            animate={animate}
            exit={initial}
            transition={transition2}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: 0.6, ease }
const styleObj = { transformOrigin: "left center" as const }
const initial = { opacity: 0, x: -14 }
const animate = { opacity: 1, x: 0 }
const transition2 = { duration: 0.25, delay: 0.12, ease }
