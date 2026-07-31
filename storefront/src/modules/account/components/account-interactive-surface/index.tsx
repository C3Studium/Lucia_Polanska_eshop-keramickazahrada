"use client"

import { motion } from "framer-motion"
import { useState, type FocusEvent, type ReactNode } from "react"

import {
  accountListContentVariants,
  accountListSurfaceVariants,
} from "../../motion"
import styles from "./style.module.scss"

type AccountInteractiveSurfaceProps = {
  children: ReactNode
  className?: string
  contentClassName?: string
}

export default function AccountInteractiveSurface({
  children,
  className,
  contentClassName,
}: AccountInteractiveSurfaceProps) {
  const [hovered, setHovered] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const visualState = hovered || focusWithin ? "active" : "rest"

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFocusWithin(false)
    }
  }

  return (
    <motion.div
      className={`${styles.root} ${className ?? ""}`}
      initial={false}
      animate={visualState}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={handleBlur}
    >
      <motion.span
        className={styles.surface}
        variants={accountListSurfaceVariants}
        style={{ originX: 0 }}
        aria-hidden="true"
      />
      <motion.div
        className={`${styles.content} ${contentClassName ?? ""}`}
        variants={accountListContentVariants}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
