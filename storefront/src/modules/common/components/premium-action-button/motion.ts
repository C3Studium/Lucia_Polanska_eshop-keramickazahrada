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

/**
 * Odkrytí světlé kopie popisku — musí kopírovat výplň, ne se s ní míjet.
 *
 * Ořez zprava jde od 100 % k nule stejně, jako výplň roste od nuly do plné
 * šířky, takže hranice mezi tmavým a světlým textem leží přesně na hraně
 * výplně. Používá se s `premiumButtonFillTransition`, aby obojí trvalo stejně.
 *
 * `clipPath` schválně, ne `width` s `overflow: hidden`: to druhé by text
 * zužovalo a písmena by se během přejezdu smršťovala.
 */
export const premiumButtonLabelRevealVariants: Variants = {
  [PREMIUM_BUTTON_REST]: { clipPath: "inset(0 100% 0 0)" },
  [PREMIUM_BUTTON_ACTIVE]: { clipPath: "inset(0 0% 0 0)" },
}

/*
 * Popisek se přebarvuje NESYMETRICKY, a musí.
 *
 * Výplň roste i mizí od levého okraje (`transform-origin: left center`),
 * takže cesta tam a cesta zpátky nejsou totéž:
 *
 * - **Najetí** — výplň popisek postupně zakrývá. Přebarvit ho na světlo hned
 *   by znamenalo světlý text na krémovém pozadí, dokud k němu výplň nedojede.
 *   Zpoždění 0.15 s je čas, za který ho stihne přejet.
 *
 * - **Odjetí** — výplň se stahuje zpátky doleva a popisek odkrývá. Tady stejné
 *   zpoždění dělalo přesně to, čemu se mělo předejít: prvních 0.15 s svítil
 *   světlý text na už odkrytém krému, tedy nebyl vidět vůbec. Přesně to je
 *   na snímku od uživatele — výplň na čtvrtině a po popisku ani stopa.
 *
 * Zpět do tmavé se proto přechází bez odkladu a rychle.
 */
export const premiumButtonForegroundVariants: Variants = {
  [PREMIUM_BUTTON_REST]: {
    color: `var(--premium-button-ink, ${palette.ink05})`,
    transition: {
      duration: 0.08,
      delay: 0,
      ease: "easeOut",
    },
  },
  [PREMIUM_BUTTON_ACTIVE]: {
    color: `var(--premium-button-active-ink, ${palette.cream06})`,
    transition: {
      duration: 0.1,
      delay: 0.07,
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
