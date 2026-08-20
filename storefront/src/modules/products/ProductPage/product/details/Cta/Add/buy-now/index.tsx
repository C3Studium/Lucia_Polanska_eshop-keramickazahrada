"use client"

import { getBuyNowEligibility, startExpressBuyNow } from "@lib/data/express-cart"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import styles from "./style.module.scss"

type BuyNowButtonProps = {
  variantId?: string
  quantity: number
  countryCode: string
  handle?: string | null
  /** Build-time auth hint — true only when the page rendered per-request. */
  initialEligible?: boolean
  disabled?: boolean
}

/**
 * „Koupit ihned" — the shortest path there is: one click, and a logged-in
 * customer with a saved address lands straight on the express payment step
 * (variant in the cart, address prefilled, Česká pošta na adresu preselected).
 * The server action degrades the landing step when a precondition breaks, so
 * this button can never lead into a dead end — worst case it opens the express
 * flow at its first step.
 *
 * The PDP ships as prebuilt (anonymous) HTML, so when the hint prop says „no",
 * the button asks the server from the browser after mount and appears only for
 * a logged-in customer with a saved address. Everyone else never sees it.
 */
export default function BuyNowButton({
  variantId,
  quantity,
  countryCode,
  handle,
  initialEligible = false,
  disabled = false,
}: BuyNowButtonProps) {
  const router = useRouter()
  const [eligible, setEligible] = useState(initialEligible)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialEligible) return
    let cancelled = false
    getBuyNowEligibility()
      .then((ok) => {
        if (!cancelled && ok) setEligible(true)
      })
      .catch(() => {
        /* Probe failed → button simply stays hidden. */
      })
    return () => {
      cancelled = true
    }
  }, [initialEligible])

  const start = async () => {
    if (!variantId || !handle || disabled || isStarting) return

    setIsStarting(true)
    setError(null)

    try {
      const result = await startExpressBuyNow({
        countryCode,
        variantId,
        quantity,
      })

      if (!result.success) {
        throw new Error(
          result.message ||
            "Rychlý nákup se teď nepodařilo spustit. Zkuste to prosím znovu."
        )
      }

      const suffix = result.step === "selection" ? "" : `?step=${result.step}`
      router.push(`/${countryCode}/express-checkout/${handle}${suffix}`)
    } catch (startError: any) {
      setError(
        startError?.message ||
          "Rychlý nákup se teď nepodařilo spustit. Zkuste to prosím znovu."
      )
      setIsStarting(false)
    }
  }

  if (!eligible) return null

  const isDisabled = disabled || isStarting || !variantId || !handle

  return (
    <div className={styles.root}>
      <motion.button
        type="button"
        className={styles.button}
        onClick={start}
        disabled={isDisabled}
        aria-busy={isStarting || undefined}
        data-testid="buy-now-button"
        initial="rest"
        animate="rest"
        whileHover={isDisabled ? "rest" : "hover"}
        whileFocus={isDisabled ? "rest" : "hover"}
        whileTap={isDisabled ? undefined : whileTap}
      >
        <motion.span
          className={styles.indicator}
          variants={fillVariants}
          style={fillStyle}
          transition={fillTransition}
        />
        <span className={styles.label}>
          {isStarting ? "Připravujeme…" : "Koupit ihned"}
        </span>
      </motion.button>
      <p className={styles.hint}>Doručíme na vaši uloženou adresu.</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}


/* Hoisted from JSX: static motion objects — same convention as CartButton. */
const fillVariants = {
  rest: { scaleX: 0 },
  hover: { scaleX: 1 },
}
const fillStyle = { originX: 0 }
const fillTransition = { duration: 0.48, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const whileTap = { scale: 0.985 }
