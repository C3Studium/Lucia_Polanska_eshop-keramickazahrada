import type { Variants } from "framer-motion"

import { easeReveal, easeMicro, duration } from "@lib/motion-tokens"

/*
 * The rises are written in `vh`, not px, so the card travels the same share of the screen on every
 * display instead of a fixed 24px that reads as a jump on a 720px laptop and as nothing on a 2552px
 * monitor. The conversion is the measured 1080px desktop: 24/1080 = 2.2vh, 12/1080 = 1.1vh — the
 * distance is unchanged at 1080 and scales from there.
 *
 * Both ends of every pair carry the same unit ("0vh", not 0). Framer interpolates between values of
 * the same shape; "2.2vh" → 0 mixes a unit with a bare number and the tween stops being smooth.
 */
export const noticeVariants: Variants = {
  hidden: { opacity: 0, y: "2.2vh" },
  visible: {
    opacity: 1,
    y: "0vh",
    transition: { duration: duration.reveal, ease: easeReveal, delay: 0.9 },
  },
  exit: {
    opacity: 0,
    y: "1.1vh",
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

/* Same 1080px conversion as the banner: 28/1080 = 2.6vh, 16/1080 = 1.5vh. `scale` is a ratio and
   has no unit to convert. */
export const dialogPanelVariants: Variants = {
  hidden: { opacity: 0, y: "2.6vh", scale: 0.985 },
  visible: {
    opacity: 1,
    y: "0vh",
    scale: 1,
    transition: { duration: duration.reveal, ease: easeReveal },
  },
  exit: {
    opacity: 0,
    y: "1.5vh",
    scale: 0.99,
    transition: { duration: duration.micro, ease: easeMicro },
  },
}
