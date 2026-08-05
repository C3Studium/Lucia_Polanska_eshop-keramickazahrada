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
