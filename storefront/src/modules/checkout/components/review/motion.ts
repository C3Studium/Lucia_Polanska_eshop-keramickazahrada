import type { Variants } from "framer-motion"

import { easeMicro, duration } from "@lib/motion-tokens"

export const headingTransition = { duration: 0.46, ease: easeMicro }

export const contentVariants: Variants = {
  hidden: { opacity: 0, height: 0, y: 12, clipPath: "inset(0 0 100% 0)" },
  visible: {
    opacity: 1,
    height: "auto",
    y: 0,
    clipPath: "inset(0 0 0% 0)",
    transition: { duration: 0.58, ease: easeMicro },
  },
  exit: {
    opacity: 0,
    height: 0,
    y: -8,
    clipPath: "inset(100% 0 0 0)",
    transition: { duration: 0.58, ease: easeMicro },
  },
}

export const rowVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeMicro } },
}

export const errorVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeMicro } },
  exit: { opacity: 0, transition: { duration: duration.micro, ease: easeMicro } },
}
