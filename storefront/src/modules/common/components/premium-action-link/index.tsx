"use client"

import { motion, type Variants } from "framer-motion"
import { useState, type FocusEvent } from "react"
import LocalizedClientLink from "../localized-client-link"
import styles from "./style.module.scss"

type PremiumActionLinkProps = {
  href: string
  text: string
  className?: string
}

const fillVariants: Variants = {
  rest: { scaleX: 0, 
      transition: { 
        duration: 0.3,
        ease: "easeOut"
    }  },
  active: { scaleX: 1, 
      transition: { 
        duration: 0.3,
        ease: "easeOut"
    }  },
}

const foregroundVariants: Variants = {
  rest: {
    color: "var(--premium-link-ink, #ffe8d6)",
    transition: { duration: 0.18, delay: 0.15, ease: "easeOut" },
  },
  active: {
    color: "var(--premium-link-active-ink, #20211c)",
    transition: { duration: 0.18, delay: 0.15, ease: "easeOut" },
  },
}

const arrowVariants: Variants = {
  rest: {
    rotate: 0,
    transition: { duration: 0.3, delay: 0.25, ease: [0.22, 1, 0.36, 1] },
  },
  active: {
    rotate: 45,
    transition: { duration: 0.3, delay: 0.25, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function PremiumActionLink({
  href,
  text,
  className,
}: PremiumActionLinkProps) {
  const [hovered, setHovered] = useState(false)
  const [focusVisible, setFocusVisible] = useState(false)
  const visualState = hovered || focusVisible ? "active" : "rest"

  return (
    <LocalizedClientLink
      href={href}
      className={`${styles.root} ${className ?? ""}`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={() => setFocusVisible(false)}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) =>
        setFocusVisible(event.currentTarget.matches(":focus-visible"))
      }
      onBlur={() => setFocusVisible(false)}
    >
      <motion.span
        className={styles.surface}
        variants={fillVariants}
        initial="rest"
        animate={visualState}
        style={styleObj}
        transition={transition}
        aria-hidden="true"
      />
      <motion.span
        className={styles.label}
        variants={foregroundVariants}
        initial="rest"
        animate={visualState}
      >
        {text}
      </motion.span>
      <motion.span
        className={styles.arrow}
        variants={foregroundVariants}
        initial="rest"
        animate={visualState}
        aria-hidden="true"
      >
        <motion.i
          variants={arrowVariants}
          initial="rest"
          animate={visualState}
        >
          ↗
        </motion.i>
      </motion.span>
    </LocalizedClientLink>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const styleObj = { originX: 0 }
const transition = { duration: 0.72, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
