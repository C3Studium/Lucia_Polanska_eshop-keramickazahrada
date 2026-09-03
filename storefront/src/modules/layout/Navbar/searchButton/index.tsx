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

/**
 * Collapsed: a dense control in the desktop bar, a 44px target on a phone.
 *
 * {@link CLOSED_WIDTH} is only the pre-layout fallback now. The closed control is a circle, so
 * its width is whatever its height is, and that height is a clamp on viewport height in CSS
 * (`--search-control-size`, which reads the bar's `--nav-control-height`). 36 is that clamp's
 * floor, so it is also what the server render and the first client render agree on.
 */
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
   * The disc, read back rather than copied. Its size is a clamp on viewport height in the
   * stylesheet, which is not a number that can be handed to JS, and the closed width has to
   * equal it exactly or the circle turns into an ellipse. Measuring keeps the size in one place.
   *
   * The button rather than the wrapper: the wrapper's width is the value being animated here, so
   * measuring it would feed its own output back in, and on a phone its height is `100%` of the
   * pill. The button's height is the size variable in every regime.
   */
  const buttonRef = useRef<HTMLButtonElement>(null)

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
    }

    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  /*
   * The closed width follows the disc's own height, so the circle stays a circle while the height
   * tracks the bar (`--search-control-size` is a clamp on viewport height).
   *
   * A ResizeObserver rather than the resize listener above, for two reasons: the button has no
   * box yet on the first commit — measuring there returned 0 and the control stayed pinned at the
   * fallback 36 for the life of the page — and the height answers to viewport *height* and to the
   * root rem above 1921, so it can move without a layout the window listener would catch.
   *
   * It cannot feed itself: this reads the button's height, and the value it sets is the wrapper's
   * width. Where the phone rules make the button `width: 100%`, a width change re-runs this and
   * reads the same height back, so React bails on the identical number.
   */
  useEffect(() => {
    const el = buttonRef.current
    if (!el) return

    const sync = () => {
      if (window.innerWidth <= PHONE_WIDTH) {
        setClosedWidth(CLOSED_WIDTH_PHONE)
        return
      }
      const measured = Math.round(el.getBoundingClientRect().height)
      if (measured > 0) setClosedWidth(measured)
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    window.addEventListener("resize", sync)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", sync)
    }
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
        ref={buttonRef}
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
