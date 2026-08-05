import type { Variants } from "framer-motion"

import { easeReveal, easeMicro, duration } from "@lib/motion-tokens"

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.reveal, ease: easeReveal } },
  exit: { opacity: 0, transition: { duration: duration.transition, ease: easeReveal } },
}

export const backdropVariants: Variants = {
  hidden: { opacity: 0, backdropFilter: "blur(0px)" },
  visible: {
    opacity: 1,
    backdropFilter: "blur(9px)",
    transition: { duration: 0.5, ease: easeReveal },
  },
  exit: {
    opacity: 0,
    backdropFilter: "blur(0px)",
    transition: { duration: duration.transition, ease: easeReveal },
  },
}

export const panelVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.68, ease: easeReveal } },
  exit: { opacity: 0, y: 12, scale: 0.985, transition: { duration: 0.48, ease: easeReveal } },
}

export const contentVariants: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.2, staggerChildren: 0.055 } },
}

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.58, ease: easeReveal } },
}

export const visualPanelVariants: Variants = {
  hidden: { opacity: 0, clipPath: "inset(0 0 100% 0 round 18px)" },
  visible: {
    opacity: 1,
    clipPath: "inset(0 0 0% 0 round 18px)",
    transition: { delay: 0.14, duration: 0.88, ease: easeReveal },
  },
  exit: {
    opacity: 0,
    clipPath: "inset(0 0 100% 0 round 18px)",
    transition: { duration: duration.transition, ease: easeReveal },
  },
}

export const detailsVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.48, duration: 0.62, ease: easeReveal },
  },
}

/** The close button grows to reveal its label; width is animated, so it lives here as data. */
export const closeButtonWidth = { rest: 42, hovered: 96 }

export const closeLabelVariants: Variants = {
  hidden: { opacity: 0, x: 10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, delay: 0.1, ease: easeReveal } },
  exit: { opacity: 0, x: 8, transition: { duration: duration.micro, ease: easeMicro } },
}

/** Status messages (success, failure) arrive without drama. */
export const statusVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeMicro } },
  exit: { opacity: 0, transition: { duration: duration.micro, ease: easeMicro } },
}

export const closeTransition = { duration: 0.5, ease: easeReveal }
