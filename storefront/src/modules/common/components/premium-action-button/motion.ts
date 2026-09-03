import type { Transition, Variants } from "framer-motion"
import { palette } from "styles/palette.generated"

export const PREMIUM_BUTTON_REST = "rest"
export const PREMIUM_BUTTON_ACTIVE = "hover"

export const premiumButtonFillVariants: Variants = {
  [PREMIUM_BUTTON_REST]: { 
      scaleX: 0, 
      transition: { 
        duration: 0.3,
        ease: "easeOut"
    } 
  },
  [PREMIUM_BUTTON_ACTIVE]: { scaleX: 1,
    transition: { 
        duration: 0.3,
        ease: "easeOut"
    } 
   },
}

export const premiumButtonFillTransition: Transition = {
  duration: 0.8,
  ease: [0.76, 0, 0.24, 1],
}

export const premiumButtonForegroundVariants: Variants = {
  [PREMIUM_BUTTON_REST]: {
    color: `var(--premium-button-ink, ${palette.ink05})`,
    transition: {
      duration: 0.18,
      delay: 0.15,
      ease: "easeOut",
    },
  },
  [PREMIUM_BUTTON_ACTIVE]: {
    color: `var(--premium-button-active-ink, ${palette.cream06})`,
    transition: {
      duration: 0.18,
      delay: 0.15,
      ease: "easeOut",
    },
  },
}

export const premiumButtonArrowVariants: Variants = {
  [PREMIUM_BUTTON_REST]: {
    rotate: 0,
    transition: {
      duration: 0.3,
      delay: 0.25,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  [PREMIUM_BUTTON_ACTIVE]: {
    rotate: 45,
    transition: {
      duration: 0.3,
      delay: 0.25,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}
