"use client"

import { convertToLocale } from "@lib/util/money"
import {
  HttpTypes,
  StoreCart,
  StoreCartShippingOption,
  StorePrice,
} from "@medusajs/types"
import PremiumActionLink from "@modules/common/components/premium-action-link"
import { itemText } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"
import { useCopyBlock } from "@modules/common/components/cms-text/copy-context"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import styles from "./style.module.scss"
import { palette } from "styles/palette.generated"

/**
 * Texty upozornění na dopravu zdarma — položky `doprava.*` bloku `global.kosik`
 * (poskytuje hlavní layout). Kolik zbývá a jestli je hranice splněná, počítá
 * kód z ceníku dopravy; z CMS jsou jen slova kolem.
 */
const NUDGE_DEFAULTS = {
  "doprava.stitek": "Doprava zdarma",
  "doprava.nadpis": "Ještě kousek.",
  /** Za větou následuje částka (z kódu). */
  "doprava.text": "Do dopravy zdarma vám zbývá",
  "doprava.splneno.nadpis": "Dopravu platíme my.",
  "doprava.splneno.text": "Máte nakoupeno tolik, že dopravu platíme my.",
  "doprava.kosik": "Otevřít košík",
  "doprava.obchod": "Nakupovat dál",
  "doprava.radek": "K dopravě zdarma zbývá",
  "doprava.radek-splneno": "Doprava zdarma je připravená",
} as const

type NudgeLabel = keyof typeof NUDGE_DEFAULTS
const nudgeText = (copy: CopyBlock | undefined, label: NudgeLabel) =>
  itemText(copy, label, NUDGE_DEFAULTS[label])

type FreeShippingPrice = StorePrice & {
  target_reached: boolean
  target_remaining: number
  remaining_percentage: number
}

const ease = [0.22, 1, 0.36, 1] as const

const computeTarget = (
  cart: HttpTypes.StoreCart,
  price: HttpTypes.StorePrice
) => {
  const rule = (price.price_rules || []).find(
    (candidate) => candidate.attribute === "item_total"
  )

  if (!rule) return null

  const current = cart.item_total
  const target = Number(rule.value)
  const reached =
    rule.operator === "gt"
      ? current > target
      : rule.operator === "gte"
      ? current >= target
      : rule.operator === "lt"
      ? current < target
      : rule.operator === "lte"
      ? current <= target
      : current === target

  const remaining =
    reached || rule.operator === "lt" || rule.operator === "lte"
      ? 0
      : Math.max(0, target + (rule.operator === "gt" ? 1 : 0) - current)

  return {
    target_reached: reached,
    target_remaining: remaining,
    remaining_percentage: Math.max(
      0,
      Math.min(100, target > 0 ? (current / target) * 100 : 100)
    ),
  }
}

export default function ShippingPriceNudge({
  variant = "inline",
  cart,
  shippingOptions,
}: {
  variant?: "popup" | "inline"
  cart: StoreCart
  shippingOptions: StoreCartShippingOption[]
}) {
  if (!cart || !shippingOptions?.length) return null

  const freeShippingPrice = shippingOptions
    .flatMap((shippingOption) =>
      (shippingOption.prices ?? [])
        .filter(
          (price) =>
            price.currency_code === cart.currency_code &&
            price.amount === 0 &&
            (price.price_rules || []).some(
              (rule) => rule.attribute === "item_total"
            )
        )
        .flatMap((price) => {
          const target = computeTarget(cart, price)
          return target ? [{ ...price, ...target }] : []
        })
    )
    .at(0) as FreeShippingPrice | undefined

  if (!freeShippingPrice) return null

  return variant === "popup" ? (
    <FreeShippingPopup cart={cart} price={freeShippingPrice} />
  ) : (
    <FreeShippingInline cart={cart} price={freeShippingPrice} />
  )
}

function Progress({
  percentage,
  reached,
}: {
  percentage: number
  reached: boolean
}) {
  return (
    <div className={styles.progress} aria-hidden="true">
      <motion.span
        initial={false}
        animate={{
          scaleX: reached ? 1 : percentage / 100,
          backgroundColor: reached ? palette.sage01 : palette.olive15,
        }}
        style={styleObj}
        transition={transition}
      />
      <motion.i
        initial={false}
        animate={{ left: `${reached ? 100 : percentage}%` }}
        transition={transition}
      />
    </div>
  )
}

function FreeShippingInline({
  cart,
  price,
}: {
  cart: StoreCart
  price: FreeShippingPrice
}) {
  const copy = useCopyBlock("global.kosik")
  const label: NudgeLabel = price.target_reached ? "doprava.radek-splneno" : "doprava.radek"
  return (
    <motion.aside
      className={styles.root}
      initial={initial}
      animate={animate}
      transition={transition2}
      aria-live="polite"
    >
      <div className={styles.inlineHeader}>
        <span {...editableItem(copy, label)}>{nudgeText(copy, label)}</span>
        {!price.target_reached && (
          <strong>
            {convertToLocale({
              amount: price.target_remaining,
              currency_code: cart.currency_code,
            })}
          </strong>
        )}
      </div>
      <Progress
        percentage={price.remaining_percentage}
        reached={price.target_reached}
      />
    </motion.aside>
  )
}

function FreeShippingPopup({
  cart,
  price,
}: {
  cart: StoreCart
  price: FreeShippingPrice
}) {
  const [isClosed, setIsClosed] = useState(false)
  const copy = useCopyBlock("global.kosik")
  const reached = price.target_reached

  useEffect(() => {
    if (!price.target_reached) return
    const timeout = window.setTimeout(() => setIsClosed(true), 2600)
    return () => window.clearTimeout(timeout)
  }, [price.target_reached])

  return (
    <AnimatePresence>
      {!isClosed && (
        <motion.aside
          className={styles.popupRoot}
          initial={initial2}
          animate={animate2}
          exit={exit2}
          transition={transition3}
          aria-live="polite"
        >
          <div className={styles.popupTop}>
            <span className={styles.popupIndex} {...editableItem(copy, "doprava.stitek")}>
              {nudgeText(copy, "doprava.stitek")}
            </span>
            <motion.button
              type="button"
              className={styles.close}
              onClick={() => setIsClosed(true)}
              aria-label="Zavřít informaci o dopravě zdarma"
              whileHover={whileHover}
              whileTap={whileTap}
              transition={transition4}
            >
              ×
            </motion.button>
          </div>

          <div className={styles.popupCopy}>
            <motion.span
              className={styles.statusDot}
              animate={
                price.target_reached
                  ? { scale: [1, 1.3, 1], opacity: [1, 0.65, 1] }
                  : { scale: 1, opacity: 1 }
              }
              transition={transition5}
              aria-hidden="true"
            />
            <div>
              <h2 {...editableItem(copy, reached ? "doprava.splneno.nadpis" : "doprava.nadpis")}>
                {nudgeText(copy, reached ? "doprava.splneno.nadpis" : "doprava.nadpis")}
              </h2>
              {/* Věta s částkou: z CMS slova, částka z kódu — proto věta ve
                  vlastním spanu (anotace), mezera a `strong` za ní. */}
              <p>
                {reached ? (
                  <span {...editableItem(copy, "doprava.splneno.text")}>
                    {nudgeText(copy, "doprava.splneno.text")}
                  </span>
                ) : (
                  <>
                    <span {...editableItem(copy, "doprava.text")}>
                      {nudgeText(copy, "doprava.text")}
                    </span>{" "}
                  </>
                )}
                {!price.target_reached && (
                  <strong>
                    {convertToLocale({
                      amount: price.target_remaining,
                      currency_code: cart.currency_code,
                    })}
                  </strong>
                )}
              </p>
            </div>
          </div>

          <Progress
            percentage={price.remaining_percentage}
            reached={price.target_reached}
          />

          <div className={styles.popupActions}>
            <PremiumActionLink
              href="/cart"
              text={nudgeText(copy, "doprava.kosik")}
              className={styles.cartLink}
            />
            {!price.target_reached && (
              <PremiumActionLink
                href="/store"
                text={nudgeText(copy, "doprava.obchod")}
                className={styles.storeLink}
              />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff.
 *
 * Souřadnice jsou ve vw/vh, ne v px, aby se dráha přeškálovala sama — v px zůstal
 * na 2552px monitoru 32px posun, který tam není vidět. Převod z původních čísel:
 *   vjezd  x 32px / 1600px reference = 2vw     y 16px / 1080px = 1.48 → 1.5vh
 *   odjezd x 24px / 1600px           = 1.5vw   y 10px / 1080px = 0.93 → 0.9vh
 *   inline y 10px / 1080px           = 0.9vh
 * Obě strany interpolace musí mít TÝŽ tvar výrazu, jinak framer skočí — proto
 * "0vw"/"0vh" v cílovém stavu, ne holá nula. */
const styleObj = { originX: 0 }
const transition = { duration: 0.8, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const initial = { opacity: 0, y: "0.9vh" }
const animate = { opacity: 1, y: "0vh" }
const transition2 = { duration: 0.55, ease }
const initial2 = { opacity: 0, x: "2vw", y: "1.5vh", scale: 0.96 }
const animate2 = { opacity: 1, x: "0vw", y: "0vh", scale: 1 }
const exit2 = {
  opacity: 0,
  x: "1.5vw",
  y: "0.9vh",
  scale: 0.96,
  clipPath: "inset(0 0 0 100%)",
}
const transition3 = { duration: 0.62, ease }
const whileHover = { rotate: 90, scale: 1.06 }
const whileTap = { scale: 0.92 }
const transition4 = { duration: 0.4, ease }
const transition5 = { duration: 0.8, ease }
