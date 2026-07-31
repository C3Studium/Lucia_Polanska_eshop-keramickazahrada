import type { Transition, Variants } from "framer-motion"

export const accountEase = [0.22, 1, 0.36, 1] as const
export const accountSweepEase = [0.76, 0, 0.24, 1] as const

export const accountPageTransition: Transition = {
  duration: 0.72,
  ease: accountEase,
}

export const accountPageVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
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
    y: 16,
  },
  visible: {
    opacity: 1,
    y: 0,
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
    y: 18,
  },
  visible: {
    opacity: 1,
    y: 0,
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
    x: 0,
    transition: { duration: 0.42, ease: accountEase },
  },
  active: {
    x: 4,
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
    y: 34,
    scale: 0.985,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.58,
      ease: accountEase,
    },
  },
  exit: {
    opacity: 0,
    y: 18,
    scale: 0.99,
    transition: {
      duration: 0.28,
      ease: "easeIn",
    },
  },
}
