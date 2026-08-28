import type { Variants } from "framer-motion"

import { easeReveal, easeMicro, duration } from "@lib/motion-tokens"

export const noticeVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.reveal, ease: easeReveal, delay: 0.9 },
  },
  exit: {
    opacity: 0,
    y: 12,
    transition: { duration: duration.micro, ease: easeMicro },
  },
}

/** The settings dialog: a backdrop that fades and a card that rises into it. */
export const dialogBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.transition, ease: easeMicro },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.micro, ease: easeMicro },
  },
}

export const dialogPanelVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: duration.reveal, ease: easeReveal },
  },
  exit: {
    opacity: 0,
    y: 16,
    scale: 0.99,
    transition: { duration: duration.micro, ease: easeMicro },
  },
}
