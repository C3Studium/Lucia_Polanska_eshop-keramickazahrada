import type { Easing } from "framer-motion"

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
