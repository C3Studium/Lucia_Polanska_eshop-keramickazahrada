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
  hidden: { opacity: 0, y: 64, filter: "blur(6px)" },
  show: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay, duration: 1.05, ease: easeReveal },
  }),
}

/** For hero imagery: uncovers rather than fades, which suits a photograph better. */
export const heroUncover: Variants = {
  hidden: { opacity: 0, clipPath: "inset(0 0 100% 0)" },
  show: (delay: number = 0) => ({
    opacity: 1,
    clipPath: "inset(0 0 0% 0)",
    transition: { delay, duration: 1.2, ease: easeReveal },
  }),
}

/**
 * A display line rising out of its own overflow. Put it on an inner element whose parent has
 * `overflow: hidden` — the parent is the mask, this is what climbs out of it. Reads far more
 * strongly than a fade at the sizes hero headings run at.
 */
export const heroLineRise: Variants = {
  hidden: { y: "110%" },
  show: (delay: number = 0) => ({
    y: "0%",
    transition: { delay, duration: 1.15, ease: easeReveal },
  }),
}

/**
 * The beats a hero arrives on, so the stagger is identical from page to page. Spread wider than
 * a typical stagger on purpose: at these type sizes the parts need to land one at a time to be
 * seen arriving at all.
 */
export const heroBeat = {
  eyebrow: 0.1,
  heading: 0.26,
  lede: 0.46,
  action: 0.62,
  chrome: 0.78,
} as const
