import type { Transition, Variants } from "framer-motion"
import { palette } from "styles/palette.generated"

export const PREMIUM_BUTTON_REST = "rest"
export const PREMIUM_BUTTON_ACTIVE = "hover"

/*
 * Jednoduché přebarvení (14. 11. 2026, Matěj: „animaci tlačítka zjednodušit").
 *
 * Dřív tmavá výplň přejížděla zleva doprava 0,8 s, pod ní se odkrývala druhá
 * kopie popisku a šipka se se zpožděním otáčela. Teď se tlačítko jen rychle
 * přebarví (0,15 s, prolnutí) a nic se nehýbe — stejně jako v obchodě, kde
 * přebarvení obstarává CSS. Barvy a stavy zůstávají.
 *
 * Výplň i světlá kopie popisku se prolínají současně a stejně dlouho, takže
 * text je v každém okamžiku čitelný (tmavý na krému, světlý na výplni).
 */
export const premiumButtonFillTransition: Transition = {
  duration: 0.15,
  ease: "easeOut",
}

export const premiumButtonFillVariants: Variants = {
  [PREMIUM_BUTTON_REST]: { opacity: 0, transition: premiumButtonFillTransition },
  [PREMIUM_BUTTON_ACTIVE]: { opacity: 1, transition: premiumButtonFillTransition },
}

export const premiumButtonLabelRevealVariants: Variants = {
  [PREMIUM_BUTTON_REST]: { opacity: 0 },
  [PREMIUM_BUTTON_ACTIVE]: { opacity: 1 },
}

export const premiumButtonForegroundVariants: Variants = {
  [PREMIUM_BUTTON_REST]: {
    color: `var(--premium-button-ink, ${palette.ink05})`,
    transition: premiumButtonFillTransition,
  },
  [PREMIUM_BUTTON_ACTIVE]: {
    color: `var(--premium-button-active-ink, ${palette.cream06})`,
    transition: premiumButtonFillTransition,
  },
}

/* Šipka zůstává na místě — otáčení byl další pohyb navíc. */
export const premiumButtonArrowVariants: Variants = {
  [PREMIUM_BUTTON_REST]: { rotate: 0 },
  [PREMIUM_BUTTON_ACTIVE]: { rotate: 0 },
}
