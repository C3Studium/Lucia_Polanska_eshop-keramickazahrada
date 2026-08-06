import type { Easing, Variants } from "framer-motion"

/**
 * The two curves the storefront animates with. Everything else is a variation of timing,
 * not of shape — one signature for reveals, one for micro-feedback.
 */

/** Entrance reveals, curtains, scroll-linked moves. The site's signature ease. */
export const easeReveal = [0.76, 0, 0.24, 1] as Easing

/** Hover fills, label swaps, toggles — anything answering a pointer. */
export const easeMicro = [0.22, 1, 0.36, 1] as Easing

/**
 * The motion budget (spec §8.2), in seconds. Hover feedback must never feel slower than
 * the customer's hand; reveals play once and get out of the way.
 */
export const duration = {
  /** 150–350 ms — micro-feedback. */
  micro: 0.25,
  /** 400–700 ms — entrance reveals. */
  reveal: 0.6,
  /** 240 ms — shared page/panel transitions. */
  transition: 0.24,
} as const

/**
 * The shared hero entrance.
 *
 * Every page opens the same way: the parts of the lockup arrive in reading order, each a beat
 * after the last. Pass the beat through `custom` rather than writing a transition per element,
 * so the rhythm is one number per item and the curve cannot drift between pages.
 *
 *   <motion.h1 variants={heroReveal} initial="hidden" animate="show" custom={0.12}>
 *
 * Where a hero already drives opacity or y from scroll, put this on an inner element — a motion
 * value in `style` wins over `animate` for the same property, so the entrance would never run.
 */
export const heroReveal: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.75, ease: easeReveal },
  }),
}

/** For hero imagery: uncovers rather than fades, which suits a photograph better. */
export const heroUncover: Variants = {
  hidden: { opacity: 0, clipPath: "inset(0 0 100% 0)" },
  show: (delay: number = 0) => ({
    opacity: 1,
    clipPath: "inset(0 0 0% 0)",
    transition: { delay, duration: 1.05, ease: easeReveal },
  }),
}

/** The beats a hero arrives on, so the stagger is identical from page to page. */
export const heroBeat = {
  eyebrow: 0.05,
  heading: 0.12,
  lede: 0.2,
  action: 0.28,
  chrome: 0.36,
} as const
