import type { Variants } from "framer-motion"

import { easeMicro, duration } from "@lib/motion-tokens"

/*
 * Souřadnice v okenních jednotkách, ne v px — dráha popsaná v procentech okna se
 * přeškáluje sama a na 2K nezůstane pozadu za typem, který tam roste rampem.
 *
 * Jedna geometrie, jedno místo:
 *   RISE_VH   = 12px na výšce 1080  →  1.11vh   (nájezd obsahu i řádků)
 *   SETTLE_VH = RISE_VH * 2/3       →  0.74vh   (odjezd a chybová hláška; dřív 8px)
 *   SHIFT_VW  = 4px na šířce 1920   →  0.21vw   (odsun neaktivního nadpisu)
 * SETTLE je odvozený, ne opsaný: když se změní nájezd, odjezd se změní s ním.
 *
 * Obě strany každé interpolace mají stejný tvar výrazu ("0vh" proti "1.11vh"),
 * jinak framer přestane hodnotu interpolovat a skočí — past z ARTEFAKTu.
 */
const RISE_VH = 1.11
const SETTLE_VH = Math.round(RISE_VH * (2 / 3) * 100) / 100 // 0.74
const SHIFT_VW = 0.21

export const RISE = `${RISE_VH}vh`
export const SETTLE = `${SETTLE_VH}vh`
export const REST_Y = "0vh"

/** Neaktivní krok couvne o vlásek doleva; aktivní stojí na nule. */
export const HEADING_REST_X = "0vw"
export const HEADING_SHIFT_X = `-${SHIFT_VW}vw`

export const headingTransition = { duration: 0.46, ease: easeMicro }

export const contentVariants: Variants = {
  hidden: { opacity: 0, height: 0, y: RISE, clipPath: "inset(0 0 100% 0)" },
  visible: {
    opacity: 1,
    height: "auto",
    y: REST_Y,
    clipPath: "inset(0 0 0% 0)",
    transition: { duration: 0.58, ease: easeMicro },
  },
  exit: {
    opacity: 0,
    height: 0,
    y: `-${SETTLE}`,
    clipPath: "inset(100% 0 0 0)",
    transition: { duration: 0.58, ease: easeMicro },
  },
}

export const rowVariants: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: { opacity: 1, y: REST_Y, transition: { duration: 0.5, ease: easeMicro } },
}

export const errorVariants: Variants = {
  hidden: { opacity: 0, y: SETTLE },
  visible: { opacity: 1, y: REST_Y, transition: { duration: 0.4, ease: easeMicro } },
  exit: { opacity: 0, transition: { duration: duration.micro, ease: easeMicro } },
}
