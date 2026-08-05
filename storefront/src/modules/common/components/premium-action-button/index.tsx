"use client"

import { motion } from "framer-motion"
import { useState } from "react"
import { useFormStatus } from "react-dom"
import {
  PREMIUM_BUTTON_ACTIVE,
  PREMIUM_BUTTON_REST,
  premiumButtonArrowVariants,
  premiumButtonFillTransition,
  premiumButtonFillVariants,
  premiumButtonForegroundVariants,
} from "./motion"
import styles from "./style.module.scss"

type PremiumActionButtonProps = {
  text: string
  onClickAction?: () => void | Promise<void>
  ClickAction?: () => void | Promise<void>
  disabled?: boolean
  active?: boolean
  compact?: boolean
  type?: "button" | "submit"
  className?: string
  "data-testid"?: string
}

const PremiumActionButton = ({
  text,
  onClickAction,
  ClickAction,
  disabled = false,
  active = false,
  compact = false,
  type = "button",
  className,
  "data-testid": dataTestId,
}: PremiumActionButtonProps) => {
  const { pending } = useFormStatus()
  const isDisabled = disabled || (type === "submit" && pending)
  const isVisuallyActive = active || (type === "submit" && pending)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocusVisible, setIsFocusVisible] = useState(false)

  const isFilled =
    isVisuallyActive ||
    (!isDisabled && (isHovered || isFocusVisible))
  const motionState = isFilled
    ? PREMIUM_BUTTON_ACTIVE
    : PREMIUM_BUTTON_REST

  return (
    <div className={`${styles.root} ${compact ? styles.compact : ""} ${isVisuallyActive ? styles.active : ""} ${className ?? ""}`}>
      <motion.button
        type={type}
        className={styles.button}
        onClick={onClickAction ?? ClickAction}
        disabled={isDisabled}
        aria-pressed={active || undefined}
        aria-busy={isDisabled || undefined}
        data-testid={dataTestId}
        variants={premiumButtonForegroundVariants}
        initial={PREMIUM_BUTTON_REST}
        animate={motionState}
        onHoverStart={() => {
          if (isDisabled && !isVisuallyActive) return
          setIsHovered(true)
        }}
        onHoverEnd={() => {
          setIsHovered(false)
        }}
        onPointerDown={() => {
          setIsFocusVisible(false)
        }}
        onFocus={(event) => {
          if (isDisabled && !isVisuallyActive) return
          setIsFocusVisible(event.currentTarget.matches(":focus-visible"))
        }}
        onBlur={() => {
          setIsFocusVisible(false)
        }}
        whileTap={isDisabled ? undefined : { scale: .985 }}
      >
        <motion.span
          className={styles.indicator}
          variants={premiumButtonFillVariants}
          style={styleObj}
          transition={premiumButtonFillTransition}
        />
        <span className={styles.label}>
          {text}
        </span>
        <motion.span
          className={styles.arrow}
          variants={premiumButtonArrowVariants}
          aria-hidden="true"
        >
          ↗
        </motion.span>
      </motion.button>
    </div>
  )
}

export default PremiumActionButton


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const styleObj = { originX: 0 }
