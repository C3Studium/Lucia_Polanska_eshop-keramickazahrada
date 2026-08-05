"use client"

import {
  Easing,
  motion,
  type Variants,
} from "framer-motion"
import styles from "./styles.module.scss"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { useState } from "react"
import ArrowRight from "@modules/common/icons/arrow-right"

type NavButton = {
  title?: string
  href?: string
  alt?: string
  icon1?: string | undefined
  icon2?: string | undefined
  Kind: "Link" | "Button"
  onClickAction?: () => void
  onTagAction?: (payload: { input: string; state: boolean }) => void
  className?: string
  tone?: "light" | "dark"
  /** So the primary button can actually submit a form rather than only handle clicks. */
  type?: "button" | "submit"
  disabled?: boolean
}

type ButtonTone = NonNullable<NavButton["tone"]>
type ButtonPalette = {
  foreground: string
  activeForeground: string
}
type ForegroundVariantCustom = {
  palette: ButtonPalette
}

const BUTTON_REST = "rest"
const BUTTON_ACTIVE = "active"
const BUTTON_EASE = [0.76, 0, 0.24, 1] as Easing
const BUTTON_FOREGROUND_EASE = [0.22, 1, 0.36, 1] as Easing

const BUTTON_PALETTES: Record<ButtonTone, ButtonPalette> = {
  light: {
    foreground: "#212222",
    activeForeground: "#ffe8d6",
  },
  dark: {
    foreground: "#ffe8d6",
    activeForeground: "#212222",
  },
}

const foregroundVariants: Variants = {
  [BUTTON_REST]: ({ palette }: ForegroundVariantCustom) => ({
    color: palette.foreground,
    transition: {
      delay: 0.04,
      duration: 0.2,
      ease: BUTTON_FOREGROUND_EASE,
    },
  }),
  [BUTTON_ACTIVE]: ({ palette }: ForegroundVariantCustom) => ({
    color: palette.activeForeground,
    transition: {
      delay: 0.24,
      duration: 0.3,
      ease: BUTTON_FOREGROUND_EASE,
    },
  }),
}

const solidFillVariants: Variants = {
  [BUTTON_REST]: {
    scaleX: 0,
    transition: {
      duration: 0.46,
      ease: BUTTON_EASE,
    },
  },
  [BUTTON_ACTIVE]: {
    scaleX: 1,
    transition: {
      duration: 0.72,
      ease: BUTTON_EASE,
    },
  },
}

const arrowWrapperVariants: Variants = {
  [BUTTON_REST]: {
    opacity: 0,
    scaleX: 0.35,
    clipPath: "inset(0 100% 0 0)",
    transition: {
      duration: 0.22,
      ease: BUTTON_EASE,
    },
  },
  [BUTTON_ACTIVE]: {
    opacity: 1,
    scaleX: 1,
    clipPath: "inset(0 0% 0 0)",
    transition: {
      duration: 0.35,
      ease: BUTTON_EASE,
    },
  },
}

const arrowSlideVariants: Variants = {
  [BUTTON_REST]: {
    x: "-100%",
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: BUTTON_EASE,
    },
  },
  [BUTTON_ACTIVE]: {
    x: "0%",
    opacity: 1,
    transition: {
      delay: 0.1,
      duration: 0.3,
      ease: BUTTON_EASE,
    },
  },
}

export default function WebButton({
  title,
  href,
  alt = "bg__image",
  icon1,
  Kind,
  onClickAction,
  className,
  tone = "light",
  type = "button",
  disabled = false,
}: NavButton) {
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const isActive = isHovered || isFocused
  const foregroundVariantCustom: ForegroundVariantCustom = {
    palette: BUTTON_PALETTES[tone],
  }

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => setIsHovered(false)

  const handleButtonClick = () => {
    onClickAction?.()
  }

  if (icon1) {
    return (
      <button
        className={`${styles.buttonIcon} ${tone === "dark" ? styles.toneDark : styles.toneLight}`}
        type="button"
        onClick={handleButtonClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
        <motion.div className={styles.slider}>
          <SolidBackground active={isActive} />
          <motion.div
            className={styles.el}
            style={{ perspective: 800 }}
            variants={foregroundVariants}
            custom={foregroundVariantCustom}
            initial={false}
            animate={isActive ? BUTTON_ACTIVE : BUTTON_REST}
          >
            <PerspectiveIcon icon1={icon1} alt={alt} />
          </motion.div>
        </motion.div>
      </button>
    )
  }

  const content = (
    <motion.div className={styles.slider}>
      <SolidBackground active={isActive} />
      <motion.div
        className={styles.el}
        style={{ perspective: 800 }}
        variants={foregroundVariants}
        custom={foregroundVariantCustom}
        initial={false}
        animate={isActive ? BUTTON_ACTIVE : BUTTON_REST}
      >
        <PerspectiveText
          label={title}
          active={isActive}
        />
      </motion.div>
    </motion.div>
  )

  const interactionProps = {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
  }
  const buttonClassName = `${styles.button} ${
    tone === "dark" ? styles.toneDark : styles.toneLight
  } ${className ?? ""}`

  if (Kind === "Link") {
    return (
      <LocalizedClientLink
        className={buttonClassName}
        href={href ?? "/"}
        {...interactionProps}
      >
        {content}
      </LocalizedClientLink>
    )
  }

  return (
    <button
      className={buttonClassName}
      onClick={handleButtonClick}
      type={type}
      disabled={disabled}
      {...interactionProps}
    >
      {content}
    </button>
  )
}

function SolidBackground({
  active,
}: {
  active: boolean
}) {
  return (
    <>
      <span className={styles.solidSurface} aria-hidden="true" />
      <motion.span
        className={styles.solidFill}
        aria-hidden="true"
        variants={solidFillVariants}
        initial={false}
        animate={active ? BUTTON_ACTIVE : BUTTON_REST}
      />
    </>
  )
}

function PerspectiveText({
  label,
  active,
}: {
  label?: string
  active: boolean
}) {
  return (
    <div className={styles.perspectiveText} style={{ transformStyle: "preserve-3d" }}>
      <p>
        {label}
        <motion.span
          className={styles.arrow}
          variants={arrowWrapperVariants}
          initial={BUTTON_REST}
          animate={active ? BUTTON_ACTIVE : BUTTON_REST}
        >
          <motion.span
            className={styles.arrowInner}
            variants={arrowSlideVariants}
            initial={BUTTON_REST}
            animate={active ? BUTTON_ACTIVE : BUTTON_REST}
          >
            <ArrowRight size={15} color="currentColor" />
          </motion.span>
        </motion.span>
      </p>
    </div>
  )
}

function PerspectiveIcon({
  icon1,
  alt,
}: {
  icon1: string | undefined
  alt: string
}) {
  return (
    <div className={styles.PerspectiveIcon} style={{ transformStyle: "preserve-3d" }}>
      <div className={styles.image__wrapper}>
        <Image src={icon1 ?? "/assets/icons/logo.svg"} alt={alt} width={50} height={25} />
      </div>
    </div>
  )
}
