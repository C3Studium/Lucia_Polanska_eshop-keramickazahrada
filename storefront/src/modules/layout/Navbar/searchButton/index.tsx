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

/** Mezera mezi otevřeným polem (levou pilulkou) a prostřední lištou. */
const CENTER_GAP = 12

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

  /*
   * Otevřené pole nesmí vjet pod prostřední lištu (20. 11. 2026, Matěj:
   * „ať to nejde přes prostřední lištu"). Ta stojí na počítači absolutně
   * uprostřed, levá pilulka se tedy rozšiřuje POD ni — 420 px stačilo, aby na
   * ~1550px okně zakrylo „Výrobu". Pole proto končí `CENTER_GAP` před její
   * levou hranou. Na telefonu je prostředek v řadě (static) a pole ho
   * odsune samo, tam se nic neomezuje.
   */
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const measure = () => {
      let limit = Math.min(MAX_OPEN_WIDTH, window.innerWidth - RESERVED_FOR_SIBLINGS)
      const wrap = wrapperRef.current
      const pill = wrap?.closest<HTMLElement>(".navbar__left")
      const center = document.querySelector<HTMLElement>(".navbar__center")
      if (wrap && pill && center && getComputedStyle(center).position === "absolute") {
        const pillStyle = getComputedStyle(pill)
        const inset =
          (parseFloat(pillStyle.paddingRight) || 0) + (parseFloat(pillStyle.borderRightWidth) || 0)
        const free =
          center.getBoundingClientRect().left - CENTER_GAP - inset - wrap.getBoundingClientRect().left
        limit = Math.min(limit, Math.floor(free))
      }
      setOpenWidth(Math.max(160, limit))
    }

    measure()
    window.addEventListener("resize", measure)
    /* Prostředek mění šířku s písmem a měřítkem — přeměřit i s ním. */
    const center = document.querySelector<HTMLElement>(".navbar__center")
    const observer =
      center && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null
    if (center) observer?.observe(center)
    if (isActive) measure()
    return () => {
      window.removeEventListener("resize", measure)
      observer?.disconnect()
    }
  }, [isActive])

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
    /*
     * Zavřené hledání = zavřená klávesnice (19. 11. 2026). Pole zůstává
     * v DOM (kvůli fokusu v ťuknutí, viz onClick níž), takže po zavření
     * křížkem nebo ťuknutím mimo drželo fokus dál — neviditelné pole
     * a klávesnice přes půl obrazovky, která nešla ničím zavřít.
     */
    if (!isActive) {
      if (document.activeElement === inputRef.current) inputRef.current?.blur()
      return
    }

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 250)
    return () => window.clearTimeout(focusTimer)
  }, [isActive])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange?.(event.currentTarget.value)
  }

  /*
   * Hledat (20. 11. 2026, Matěj): Enter, „Hledat" i lupa při otevřeném
   * hledání pole opustí (zavře klávesnici) a výsledky krátce oživí —
   * okno ZŮSTANE otevřené. Zavírá se ťuknutím mimo, křížkem nebo Esc
   * mimo pole. Esc v poli jen pole opustí.
   */
  const hledat = () => {
    inputRef.current?.blur()
    window.dispatchEvent(new Event("kz:hledat"))
  }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      hledat()
    } else if (event.key === "Escape") {
      event.stopPropagation()
      inputRef.current?.blur()
    }
  }

  return (
    <motion.div
      ref={wrapperRef}
      className={`${styles.searchControl} ${isActive ? styles.active : ""}`}
      /* Část hledání: ťuknutí sem hledání nezavírá (NavbarSearch). */
      data-search-control=""
      initial={false}
      animate={{ width: isActive ? openWidth : closedWidth }}
      transition={transition}
      style={styleObj}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-label={isActive ? "Hledat" : "Otevřít vyhledávání"}
        aria-expanded={isActive}
        aria-controls="navbar-search"
        onClick={() => {
          if (isActive) {
            hledat()
            return
          }
          onClick?.()
          /*
           * Fokus HNED v ťuknutí (16. 11. 2026, Matěj: „do vyhledávání se na
           * telefonu špatně píše"). iOS otevře klávesnici jen při fokusu
           * přímo v obsluze dotyku; fokus po 250 ms (efekt níž) klávesnici
           * neotevřel a člověk musel trefit drobné pole podruhé. Pole je proto
           * v DOM pořád, zavřené jen neviditelné.
           */
          if (!isActive) inputRef.current?.focus({ preventScroll: true })
        }}
      >
        <Image className={styles.searchIcon} src="/assets/icons/search.svg" alt="" width={19} height={19}/>
      </button>
      <motion.input
        ref={inputRef}
        className={styles.input}
        data-testid={isActive ? "navbar-search-input" : undefined}
        type="search"
        value={value}
        placeholder="Vyhledat produkty…"
        aria-label="Vyhledat produkty"
        aria-hidden={!isActive || undefined}
        tabIndex={isActive ? 0 : -1}
        autoComplete="off"
        enterKeyHint="search"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        initial={false}
        animate={isActive ? animate : initial}
        transition={transition2}
        style={isActive ? undefined : closedInputStyle}
      />
      {/* „Hledat" naskočí až po roztažení pole a při zavření zmizí hned
          (20. 11. 2026, Matěj) — jinak visel přes zužující se pole. */}
      <AnimatePresence>
        {isActive && (
          <motion.button
            key="hledat"
            type="button"
            className={styles.searchGo}
            onClick={hledat}
            data-testid="navbar-search-go"
            initial={goHidden}
            animate={goShown}
            exit={goExit}
          >
            Hledat
          </motion.button>
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
/* Zavřené pole: v DOM kvůli fokusu v ťuknutí, ale neviditelné a neklikatelné. */
const closedInputStyle = { pointerEvents: "none" as const }
/* „Hledat": příchod se zpožděním (pole se roztahuje 0.6 s), odchod rychle. */
const goHidden = { opacity: 0 }
const goShown = { opacity: 1, transition: { delay: 0.42, duration: 0.3, ease } }
const goExit = { opacity: 0, transition: { duration: 0.1, ease: "easeOut" as const } }
