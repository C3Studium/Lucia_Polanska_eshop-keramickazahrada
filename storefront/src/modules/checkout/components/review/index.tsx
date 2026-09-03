"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useSearchParams } from "next/navigation"
import { useId, useState } from "react"

import { initiatePaymentSession, mergeCartMetadata } from "@lib/data/cart"
import {
  buildComgateSessionPayload,
  extractComgateRedirectUrl,
} from "@lib/util/comgate"
import { convertToLocale } from "@lib/util/money"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { isCommissionLine } from "@lib/util/commission"
import { readCommissionBrief } from "@lib/util/made-to-order"
import { saveCommissionBrief } from "@lib/data/commission-actions"
import CommissionBrief from "../commission-brief"

import PaymentButton from "../payment-button"
import ProductionPaymentModeChoice from "../production-payment-mode"
import { selectProductionPaymentMode } from "@lib/data/made-to-order-actions"
import type { ProductionPaymentMode } from "@lib/util/made-to-order"
import OrderRecap from "./recap"
import {
  contentVariants,
  errorVariants,
  HEADING_REST_X,
  HEADING_SHIFT_X,
  headingTransition,
  rowVariants,
} from "./motion"
import styles from "./style.module.scss"

import { TERMS_VERSION } from "@lib/constants"

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

  /*
   * Which lines are commissions. Either signal counts — the catalogue category or an enabled
   * production profile — because today only the first is set on any product, and the brief
   * has to appear for the pieces she actually sells as zakázky.
   */
  const commissionLines = ((cart?.items ?? []) as any[])
    .filter(
      (item) => isCommissionLine(item) || item?.metadata?.made_to_order
    )
    .map((item) => ({
      id: item.id as string,
      title: (item.product_title || item.title) as string,
      brief: readCommissionBrief(item),
    }))

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
    // Merge server-side against a FRESH cart — spreading the component's stale
    // `cart.metadata` here could revert the production-payment amount the
    // customer just chose, right before it is charged.
    await mergeCartMetadata({
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
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
        throw new Error("Platební brána se neozvala. Zkuste to prosím znovu.")
      }

      window.location.assign(redirectUrl)
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Platbu se nepovedlo spustit. Zkuste to prosím znovu."
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
          animate={{
            opacity: isOpen ? 1 : 0.42,
            x: isOpen ? HEADING_REST_X : HEADING_SHIFT_X,
          }}
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

            {/* The brief, one per commissioned line: what they want, and pictures of it.
                Placed before the money, because it is the thing being bought. */}
            {commissionLines.map((line) => (
              <motion.div
                key={line.id}
                variants={rowVariants}
                initial="hidden"
                animate="visible"
              >
                <CommissionBrief
                  variant="checkout"
                  title={line.title}
                  // The text is the specification; older lines may still carry it as `note`.
                  note={line.brief.specification || line.brief.note || ""}
                  photos={line.brief.photos ?? []}
                  onSubmitAction={async (input) =>
                    saveCommissionBrief(line.id, input)
                  }
                />
              </motion.div>
            ))}

            {/* Commissioned pieces: pay a deposit now or the whole amount. Rendered only when
                the cart actually contains one — the API says so, we do not infer it. */}
            {productionMode?.has_made_to_order && (
              <motion.div variants={rowVariants} initial="hidden" animate="visible">
                <ProductionPaymentModeChoice
                  initial={productionMode}
                  onSelect={(mode, amount) =>
                    selectProductionPaymentMode(cart.id, mode, amount)
                  }
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
                      Než budete pokračovat, potvrďte prosím souhlas s podmínkami.
                    </p>
                  )}
                </>
              ) : accepted ? (
                <PaymentButton
                  cart={cart}
                  data-testid="submit-order-button"
                  countryCode={countryCode}
                  /* The consent record must exist for EVERY payment path —
                     the ComGate flow writes it itself, the direct ones (osobní
                     odběr, dobírka) get it here, before placing the order. */
                  onBeforePlaceAction={recordConsent}
                />
              ) : (
                <p className={styles.gateHint}>
                  Než budete pokračovat, potvrďte prosím souhlas s podmínkami.
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
