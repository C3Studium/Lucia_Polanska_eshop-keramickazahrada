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

/*
 * Entry offsets in vh/vw rather than px: 18px measured at 1080 is 1.65vh, and expressed
 * that way the nudge keeps its proportion on a 720-tall laptop and on a 1351-tall 2K panel
 * instead of being a third of the travel on one and a tenth on the other. Both ends of each
 * pair carry a unit — `0vh`, not `0` — so framer keeps mixing them as plain numbers.
 */
export const panelVariants: Variants = {
  hidden: { opacity: 0, y: "1.65vh", scale: 0.98 },
  visible: { opacity: 1, y: "0vh", scale: 1, transition: { duration: 0.68, ease: easeReveal } },
  exit: { opacity: 0, y: "1.1vh", scale: 0.985, transition: { duration: 0.48, ease: easeReveal } },
}

export const contentVariants: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.2, staggerChildren: 0.055 } },
}

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: "1.4vh" },
  visible: { opacity: 1, y: "0vh", transition: { duration: 0.58, ease: easeReveal } },
}

/**
 * One corner, one place: `.visualPanel { border-radius }` in style.module.scss is the same
 * 1.125rem. The reveal clips to the card, so a mismatch shows as a square corner sliding
 * over a round one — and in rem both of them ride the root ramp above 1921.
 */
const VISUAL_PANEL_RADIUS = "1.125rem"

export const visualPanelVariants: Variants = {
  hidden: { opacity: 0, clipPath: `inset(0 0 100% 0 round ${VISUAL_PANEL_RADIUS})` },
  visible: {
    opacity: 1,
    clipPath: `inset(0 0 0% 0 round ${VISUAL_PANEL_RADIUS})`,
    transition: { delay: 0.14, duration: 0.88, ease: easeReveal },
  },
  exit: {
    opacity: 0,
    clipPath: `inset(0 0 100% 0 round ${VISUAL_PANEL_RADIUS})`,
    transition: { duration: duration.transition, ease: easeReveal },
  },
}

export const detailsVariants: Variants = {
  hidden: { opacity: 0, y: "1.65vh" },
  visible: {
    opacity: 1,
    y: "0vh",
    transition: { delay: 0.48, duration: 0.62, ease: easeReveal },
  },
}

/*
 * The close button grows to reveal its label; width is animated, so it lives here as data —
 * but derived, not transcribed. The collapsed width IS the box `.close` draws: 0.3125rem of
 * padding on each side + the 1.875rem icon + a 1px border on each edge (everything is
 * border-box). Hovered is that plus the room the label needs. Written in rem so the pill
 * follows the >=1921 root ramp with the rest of the header instead of sitting at 42px on a
 * 2552 screen; `initial={false}` on the button means framer starts from these values rather
 * than from a computed px, so it never has to mix two units.
 */
const CLOSE_PAD_REM = 0.3125
const CLOSE_ICON_REM = 1.875
const CLOSE_BORDER_REM = 1 / 16
const CLOSE_LABEL_REM = 3.375
const CLOSE_REST_REM = CLOSE_PAD_REM * 2 + CLOSE_ICON_REM + CLOSE_BORDER_REM * 2

export const closeButtonWidth = {
  rest: `${CLOSE_REST_REM}rem`,
  hovered: `${CLOSE_REST_REM + CLOSE_LABEL_REM}rem`,
}

export const closeLabelVariants: Variants = {
  hidden: { opacity: 0, x: "0.5vw" },
  visible: { opacity: 1, x: "0vw", transition: { duration: 0.25, delay: 0.1, ease: easeReveal } },
  exit: { opacity: 0, x: "0.4vw", transition: { duration: duration.micro, ease: easeMicro } },
}

/** Status messages (success, failure) arrive without drama. */
export const statusVariants: Variants = {
  hidden: { opacity: 0, y: "0.75vh" },
  visible: { opacity: 1, y: "0vh", transition: { duration: 0.4, ease: easeMicro } },
  exit: { opacity: 0, transition: { duration: duration.micro, ease: easeMicro } },
}

export const closeTransition = { duration: 0.5, ease: easeReveal }
