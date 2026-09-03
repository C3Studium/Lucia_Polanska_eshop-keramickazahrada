"use client"

import ArrowRight from "@modules/common/icons/arrow-right"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Easing, motion } from "framer-motion"
import { useState } from "react"
import styles from "./styles.module.scss"
import { palette } from "styles/palette.generated"

type CollectionCategoryLinkProps = {
  className?: string
  color?: string
  href: string
  hoverColor?: string
  hoverOpacity?: number
  label: string
  onClick?: () => void
}

const ease = [0.76, 0, 0.24, 1] as Easing

/*
 * The reveal is a unitless 0→1 scalar. The two lengths it opens — the icon box and the gap in
 * front of it — live in the stylesheet as `--arrow-w` / `--arrow-gap`, so the window and the box
 * are one number in one place. Naming 18px here instead froze the window at 18px above 1921px,
 * where the rem ramp grows the box inside it to ~24px and the arrowhead was clipped.
 */
const arrowWrapper = {
  rest: { "--arrow-reveal": 0, opacity: 0 },
  hover: {
    "--arrow-reveal": 1,
    opacity: 1,
    transition: { duration: 0.35, ease },
  },
}

const arrowSlide = {
  rest: {
    x: "-100%",
    opacity: 0,
    transition: { duration: 0.2, ease },
  },
  hover: {
    x: "0%",
    opacity: 1,
    transition: { delay: 0.1, duration: 0.3, ease },
  },
}

const underline = {
  rest: {
    x: "-101%",
    transition: { delay: 0.1, duration: 0.4, ease },
  },
  hover: {
    x: "0%",
    transition: { duration: 0.45, ease },
  },
}

export default function CollectionCategoryLink({
  className = "",
  color = palette.white,
  href,
  hoverColor = palette.ambientShowcase1,
  hoverOpacity = 1,
  label,
  onClick,
}: CollectionCategoryLinkProps) {
  const [isHovered, setIsHovered] = useState(false)
  const state = isHovered ? "hover" : "rest"

  return (
    <LocalizedClientLink
      href={href}
      className={`${styles.root} ${className}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      <motion.span
        className={styles.label}
        initial="rest"
        animate={state}
        variants={{
          rest: { color, opacity: 1, transition: { duration: 0.3, ease } },
          hover: { color: hoverColor, opacity: hoverOpacity, transition: { duration: 0.3, ease } },
        }}
      >
        {label}
        <motion.span className={styles.arrow} variants={arrowWrapper} initial="rest" animate={state}>
          <motion.span className={styles.arrowInner} variants={arrowSlide} initial="rest" animate={state}>
            <ArrowRight size={17} color={hoverColor} />
          </motion.span>
        </motion.span>
      </motion.span>
      <span className={styles.underlineMask}>
        <motion.span
          className={styles.underline}
          style={{ backgroundColor: hoverColor }}
          variants={underline}
          initial="rest"
          animate={state}
        />
      </span>
    </LocalizedClientLink>
  )
}
