import type { Transition, Variants } from "framer-motion"

/*
 * Souřadnice ve vw/vh, ne v px — dráha popsaná v procentech okna se přeškáluje
 * sama, místo aby se na 2K monitoru scvrkla na nic. Referenční obrazovka je
 * 1080 na výšku (svisle) a 1440 na šířku (vodorovně), takže původní hodnoty
 * platí přesně tam, kde byly navržené:
 *
 *   y: 34 -> 3.15vh   y: 24 -> 2.2vh   y: 18 -> 1.65vh   y: 16 -> 1.5vh
 *   x:  4 -> 0.28vw
 *
 * Obě strany každé interpolace nesou jednotku ("0vh", ne holá 0): framer
 * interpoluje spolehlivě jen když mají oba konce stejný TVAR výrazu.
 *
 * Že vh v tomhle framer-motion (12.23) opravdu interpoluje a doběhne, měří
 * .rdshots/zz-lead-vh-motion.cjs proti jeho vlastnímu runtime — na 1366x768
 * je `y: "-1.8vh" -> "0vh"` v půlce -7.46px z -13.82px a končí na `none`,
 * a `mix("-1.8vh","0vh")(0.5)` vrací "-0.9vh". Starší poznámka tvrdící opak
 * byla vyvrácena a smazána; neoživovat ji bez nového měření.
 */

export const accountEase = [0.22, 1, 0.36, 1] as const
export const accountSweepEase = [0.76, 0, 0.24, 1] as const

export const accountPageTransition: Transition = {
  duration: 0.72,
  ease: accountEase,
}

export const accountPageVariants: Variants = {
  hidden: {
    opacity: 0,
    y: "2.2vh",
  },
  visible: {
    opacity: 1,
    y: "0vh",
    transition: {
      ...accountPageTransition,
      staggerChildren: 0.09,
      delayChildren: 0.04,
    },
  },
}

export const accountSectionVariants: Variants = {
  hidden: {
    opacity: 0,
    y: "1.5vh",
  },
  visible: {
    opacity: 1,
    y: "0vh",
    transition: {
      duration: 0.64,
      ease: accountEase,
    },
  },
}

export const accountListVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.08,
    },
  },
}

export const accountListItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: "1.65vh",
  },
  visible: {
    opacity: 1,
    y: "0vh",
    transition: {
      duration: 0.58,
      ease: accountEase,
    },
  },
}

export const accountListSurfaceVariants: Variants = {
  rest: {
    scaleX: 0,
    opacity: 0,
    transition: {
      scaleX: { duration: 0.46, ease: accountSweepEase },
      opacity: { duration: 0.2, ease: "easeOut" },
    },
  },
  active: {
    scaleX: 1,
    opacity: 1,
    transition: {
      scaleX: { duration: 0.72, ease: accountSweepEase },
      opacity: { duration: 0.24, ease: "easeOut" },
    },
  },
}

export const accountListContentVariants: Variants = {
  rest: {
    x: "0vw",
    transition: { duration: 0.42, ease: accountEase },
  },
  active: {
    x: "0.28vw",
    transition: { duration: 0.54, delay: 0.08, ease: accountEase },
  },
}

export const accountDisclosureVariants: Variants = {
  closed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.42, ease: accountSweepEase },
      opacity: { duration: 0.2, ease: "easeOut" },
    },
  },
  open: {
    height: "auto",
    opacity: 1,
    transition: {
      height: { duration: 0.58, ease: accountSweepEase },
      opacity: { duration: 0.28, delay: 0.16, ease: "easeOut" },
    },
  },
}

export const accountBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.28, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.22, ease: "easeIn" },
  },
}

export const accountModalVariants: Variants = {
  hidden: {
    opacity: 0,
    y: "3.15vh",
    scale: 0.985,
  },
  visible: {
    opacity: 1,
    y: "0vh",
    scale: 1,
    transition: {
      duration: 0.58,
      ease: accountEase,
    },
  },
  exit: {
    opacity: 0,
    y: "1.65vh",
    scale: 0.99,
    transition: {
      duration: 0.28,
      ease: "easeIn",
    },
  },
}
