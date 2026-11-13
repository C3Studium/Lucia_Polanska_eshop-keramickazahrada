"use client"

import { motion } from "framer-motion"
import { useState } from "react"
import { useCoarsePointer } from "@lib/hooks/use-coarse-pointer"
import { usePlainShop } from "@modules/common/components/plain-shop"
import { useFormStatus } from "react-dom"
import {
  PREMIUM_BUTTON_ACTIVE,
  PREMIUM_BUTTON_REST,
  premiumButtonArrowVariants,
  premiumButtonFillTransition,
  premiumButtonFillVariants,
  premiumButtonForegroundVariants,
  premiumButtonLabelRevealVariants,
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

  /*
   * Na dotyku se tlačítko při odesílání nezaplní tmavou (13. 11. 2026). Každé
   * „Pokračovat…" v pokladně jinak po ťuknutí přejelo ze světlé do černé —
   * přesně to přebarvování, které na telefonu nemá být. Zvolený stav (`active`)
   * zůstává, protože nese význam; „pracuji" ukáže jen ztlumení (`.busy`).
   */
  const coarse = useCoarsePointer()

  /*
   * V obchodě, košíku a pokladně (13. 11. 2026, `PlainShop`) žádný přejezd:
   * obyčejné tlačítko s rovnými hranami, najetí ho přebarví naráz přes CSS.
   * Zvolený stav (`active`) je plný, odesílání jen ztlumí.
   */
  const plain = usePlainShop()
  if (plain) {
    return (
      <div
        className={`${styles.root} ${styles.plain} ${compact ? styles.compact : ""} ${isVisuallyActive ? styles.active : ""} ${isVisuallyActive && !active ? styles.busy : ""} ${className ?? ""}`}
      >
        <button
          type={type}
          className={`${styles.button} ${styles.plainButton} ${active ? styles.plainActive : ""}`}
          onClick={onClickAction ?? ClickAction}
          disabled={isDisabled}
          aria-pressed={active || undefined}
          aria-busy={isDisabled || undefined}
          data-testid={dataTestId}
        >
          <span className={styles.labelStack}>
            <span className={styles.label}>{text}</span>
          </span>
          <span className={styles.arrow} aria-hidden="true">
            ↗︎
          </span>
        </button>
      </div>
    )
  }

  const isFilled =
    (coarse ? Boolean(active) : isVisuallyActive) ||
    (!isDisabled && (isHovered || isFocusVisible))
  const motionState = isFilled
    ? PREMIUM_BUTTON_ACTIVE
    : PREMIUM_BUTTON_REST

  return (
    <div className={`${styles.root} ${compact ? styles.compact : ""} ${isVisuallyActive ? styles.active : ""} ${coarse && isVisuallyActive && !active ? styles.busy : ""} ${className ?? ""}`}>
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
        {/*
          Popisek je tu DVAKRÁT, a je to jediný způsob, jak ho udržet čitelný.

          Pod výplní, která přejíždí zleva doprava, nemůže mít jednobarevný text
          správnou barvu: dokud výplň nedojede, je pozadí krémové, potom tmavé.
          Přebarvení v nějakém okamžiku znamená, že chvíli předtím nebo potom
          text splývá — naměřeno 239 ms nečitelnosti při najetí a 233 ms při
          odjetí. Ladit to časováním navíc nejde, protože barvy jsou zapsané
          přes `var()` a framer mezi dvěma `var()` neinterpoluje; překlápí je
          skokem.

          Spodní kopie je tmavá a leží v toku. Horní je světlá a ořezaná
          přesně tam, kam došla výplň — obě se hýbou týmž předpisem a týmž
          časem, takže se nemají jak rozejít. V každém okamžiku je nad krémem
          vidět tmavá a nad výplní světlá.
        */}
        <span className={styles.labelStack}>
          <span className={styles.label}>{text}</span>
          <motion.span
            className={styles.labelOver}
            variants={premiumButtonLabelRevealVariants}
            transition={premiumButtonFillTransition}
            aria-hidden="true"
          >
            {text}
          </motion.span>
        </span>
        <motion.span
          className={styles.arrow}
          variants={premiumButtonArrowVariants}
          aria-hidden="true"
        >
          ↗︎
        </motion.span>
      </motion.button>
    </div>
  )
}

export default PremiumActionButton


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const styleObj = { originX: 0 }
