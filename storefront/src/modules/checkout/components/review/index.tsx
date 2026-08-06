"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useSearchParams } from "next/navigation"
import { useId, useState } from "react"

import { initiatePaymentSession, updateCart } from "@lib/data/cart"
import {
  buildComgateSessionPayload,
  extractComgateRedirectUrl,
} from "@lib/util/comgate"
import { convertToLocale } from "@lib/util/money"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import PaymentButton from "../payment-button"
import ProductionPaymentModeChoice from "../production-payment-mode"
import { selectProductionPaymentMode } from "@lib/data/made-to-order-actions"
import type { ProductionPaymentMode } from "@lib/util/made-to-order"
import OrderRecap from "./recap"
import { contentVariants, errorVariants, headingTransition, rowVariants } from "./motion"
import styles from "./style.module.scss"

/** Bumped whenever the terms change, so a recorded consent can be traced to a wording. */
const TERMS_VERSION = "2026-08"

const Review = ({
  cart,
  countryCode,
  productionMode,
}: {
  cart: any
  countryCode: string
  productionMode?: ProductionPaymentMode | null
}) => {
  const searchParams = useSearchParams()
  const [accepted, setAccepted] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const consentId = useId()

  const isOpen = searchParams.get("step") === "review"
  const comgateMethod = searchParams.get("method")

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  const previousStepsCompleted =
    cart.shipping_address &&
    (cart.shipping_methods?.length ?? 0) > 0 &&
    (cart.payment_collection || paidByGiftcard || comgateMethod)

  const payLabel = `Zaplatit ${convertToLocale({
    amount: cart?.total ?? 0,
    currency_code: cart?.currency_code ?? "czk",
  })}`

  /**
   * Consent is written to the cart *before* the payment session is created — so the record
   * exists no matter what happens at the gateway, and so updating the cart can never invalidate
   * a session that is already in flight.
   */
  const recordConsent = async () => {
    await updateCart({
      metadata: {
        ...(cart?.metadata ?? {}),
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
      },
    })
  }

  const payWithComgate = async () => {
    if (isPaying || !accepted || !comgateMethod) {
      return
    }

    setIsPaying(true)
    setError(null)

    try {
      await recordConsent()

      const result = await initiatePaymentSession(
        cart,
        buildComgateSessionPayload(cart, comgateMethod) as any
      )

      if (!result.success) {
        throw new Error(result.message)
      }

      const redirectUrl = extractComgateRedirectUrl(result.data)

      if (!redirectUrl) {
        throw new Error("Platební brána nevrátila adresu pro pokračování.")
      }

      window.location.assign(redirectUrl)
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Platbu se nepodařilo zahájit. Zkuste to prosím znovu."
      )
      setIsPaying(false)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <motion.h2
          className={styles.heading}
          initial={false}
          animate={{ opacity: isOpen ? 1 : 0.42, x: isOpen ? 0 : -4 }}
          transition={headingTransition}
        >
          Přehled
        </motion.h2>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && previousStepsCompleted && (
          <motion.div
            className={styles.content}
            key="review-content"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div variants={rowVariants} initial="hidden" animate="visible">
              <OrderRecap cart={cart} />
            </motion.div>

            {/* Commissioned pieces: pay a deposit now or the whole amount. Rendered only when
                the cart actually contains one — the API says so, we do not infer it. */}
            {productionMode?.has_made_to_order && (
              <motion.div variants={rowVariants} initial="hidden" animate="visible">
                <ProductionPaymentModeChoice
                  initial={productionMode}
                  onSelect={(mode) => selectProductionPaymentMode(cart.id, mode)}
                />
              </motion.div>
            )}

            <motion.div
              className={styles.consent}
              variants={rowVariants}
              initial="hidden"
              animate="visible"
            >
              {/* The input is wrapped so it is not a *sibling* of the label: a global
                  `input ~ label` floating-label utility in globals.scss otherwise shrinks
                  this label to 10px — and this sentence is the consent record. */}
              <span className={styles.consentBoxWrap}>
                <input
                  id={consentId}
                  type="checkbox"
                  className={styles.consentBox}
                  checked={accepted}
                  onChange={(event) => {
                    setAccepted(event.target.checked)
                    setError(null)
                  }}
                  data-testid="terms-checkbox"
                />
              </span>
              <label htmlFor={consentId} className={styles.consentLabel}>
                Souhlasím s{" "}
                <LocalizedClientLink href="/smluvni-podminky">
                  obchodními podmínkami
                </LocalizedClientLink>{" "}
                a beru na vědomí{" "}
                <LocalizedClientLink href="/ochrana-osobnich-udaju">
                  zpracování osobních údajů
                </LocalizedClientLink>
                .
              </label>
            </motion.div>

            <AnimatePresence>
              {error && (
                <motion.p
                  className={styles.error}
                  role="alert"
                  variants={errorVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div variants={rowVariants} initial="hidden" animate="visible">
              {comgateMethod ? (
                <>
                  <button
                    type="button"
                    className={styles.payButton}
                    onClick={payWithComgate}
                    disabled={!accepted || isPaying}
                    data-testid="submit-order-button"
                  >
                    {isPaying ? "Přesměrováváme k platbě…" : payLabel}
                  </button>
                  {!accepted && (
                    <p className={styles.gateHint}>
                      K pokračování prosím potvrďte souhlas s podmínkami.
                    </p>
                  )}
                </>
              ) : accepted ? (
                <PaymentButton
                  cart={cart}
                  data-testid="submit-order-button"
                  countryCode={countryCode}
                />
              ) : (
                <p className={styles.gateHint}>
                  K pokračování prosím potvrďte souhlas s podmínkami.
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Review
