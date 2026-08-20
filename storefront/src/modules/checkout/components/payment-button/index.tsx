"use client"

import {
  isComgate,
  isDobirkaPayment,
  isManual,
  isPickupPayment,
} from "@lib/constants"
import { placeOrder } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
// Button from @medusajs/ui replaced with local ClickButton
import React, { useState } from "react"
import ErrorMessage from "../error-message"
import styles from "./style.module.scss"
import { useFormStatus } from "react-dom"

import { motion } from "framer-motion";

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string,
  countryCode: string
  /** Runs right before the order is placed — the consent record, for paths
      that never touch the gateway. */
  onBeforePlaceAction?: () => Promise<void>
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  countryCode,
  "data-testid": dataTestId,
  onBeforePlaceAction,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]
  switch (true) {
    case isManual(paymentSession?.provider_id):
      return (
        <DirectPlaceOrderButton
          notReady={notReady}
          label="Potvrdit objednávku"
          onBeforePlaceAction={onBeforePlaceAction}
          data-testid={dataTestId}
        />
      )
    /* Osobní odběr and dobírka collect the money at the counter / at the door —
       the order simply completes here. Before this branch existed both fell
       into `default` and the checkout dead-ended on „Nejdřív vyberte platbu". */
    case isPickupPayment(paymentSession?.provider_id):
      return (
        <DirectPlaceOrderButton
          notReady={notReady}
          label="Potvrdit — zaplatíte při vyzvednutí"
          onBeforePlaceAction={onBeforePlaceAction}
          data-testid={dataTestId}
        />
      )
    case isDobirkaPayment(paymentSession?.provider_id):
      return (
        <DirectPlaceOrderButton
          notReady={notReady}
          label="Potvrdit — zaplatíte při převzetí"
          onBeforePlaceAction={onBeforePlaceAction}
          data-testid={dataTestId}
        />
      )
    case isComgate(paymentSession?.provider_id):
      return (
        <ComgatePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}/>
      )
    default:
      return (
        <div className={styles.root}>
            <ClickButton text="Nejdřív vyberte platbu" disabled={true} />
          </div>
      )
  }
}

const DirectPlaceOrderButton = ({
  notReady,
  label,
  onBeforePlaceAction,
  "data-testid": dataTestId,
}: {
  notReady: boolean
  label: string
  onBeforePlaceAction?: () => Promise<void>
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handlePayment = async () => {
    if (submitting) return
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await onBeforePlaceAction?.()
      await placeOrder()
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Objednávku se nepodařilo dokončit."
      )
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.root} style={styleObj}>
      <ClickButton
        className={styles.button}
        text={submitting ? "Odesíláme…" : label}
        onClickAction={handlePayment}
        disabled={notReady || submitting}
        data-testid={dataTestId ?? "submit-order-button"}
      />
      <div className={styles.errorWrap}>
        <ErrorMessage
          error={errorMessage}
          data-testid="direct-payment-error-message"
        />
      </div>
    </div>
  )
}

const ComgatePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  /* Only a real gateway URL counts. The old fallback used `session.provider_id`
     as the redirect target — the customer's browser navigated to the literal
     string „pp_comgate_comgate". */
  const redirectUrl: string | undefined =
    typeof session?.data?.redirectUrl === "string"
      ? session.data.redirectUrl
      : undefined

  const handlePayment = () => {
    if (!redirectUrl) {
      setErrorMessage(
        "Platební bránu se nepovedlo otevřít. Zkuste to prosím znovu, nebo nám napište na info@keramickazahrada.cz."
      )
      return
    }
    // The gateway takes over from here; it returns the customer to the
    // cart/[id]/confirmed|canceled|pending pages by itself.
    window.location.href = redirectUrl
  }

  return (
    <div className={styles.root} style={styleObj}>
      <ClickButton
        className={`${styles.button} ${styles.comgate}`}
        text="Zaplatit přes Comgate"
        onClickAction={handlePayment}
        disabled={notReady || !redirectUrl}
        data-testid={dataTestId}
      />
      <div className={styles.errorWrap}>
        <ErrorMessage
          error={errorMessage}
          data-testid="comgate-payment-error-message"
        />
      </div>
    </div>
  )
}


export default PaymentButton



type ClickButtonProps = {
    text: string;
    onClickAction?: () => void | Promise<void>;
    ClickAction?: () => void | Promise<void>; // backward compatibility
    disabled?: boolean;
    type?: "button" | "submit";
    className?: string;
    "data-testid"?: string;
}

// Base animated button used across the site. Can act as a submit button in forms.
function ClickButton({ onClickAction, ClickAction, disabled = false, text, type = "button", className, "data-testid": dataTestId }: ClickButtonProps) {
  const { pending } = useFormStatus();
  const isSubmitting = type === "submit" ? pending : false;
  const isDisabled = disabled || isSubmitting;
  const handleClick = onClickAction ?? ClickAction;
  const fillVariants = {
    rest: { scaleX: 0 },
    hover: { scaleX: 1 },
  }

  return (
      <div className={className ? `${styles.ClickButton} ${className}` : styles.ClickButton}>
          <motion.button
              type={type}
              className={styles.button}
              onClick={handleClick}
              disabled={isDisabled}
              aria-busy={isDisabled || undefined}
              data-testid={dataTestId}
              initial="rest"
              animate="rest"
              whileHover={isDisabled ? "rest" : "hover"}
              whileFocus={isDisabled ? "rest" : "hover"}
              whileTap={isDisabled ? undefined : { scale: .985 }}
          >
              <motion.span
                className={styles.indicator}
                variants={fillVariants}
                style={styleObj2}
                transition={transition}
              />
              <span className={styles.label}>{text}</span>
          </motion.button>
      </div>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const styleObj = { width: "100%" as const, display: "flex" as const, flexDirection: "column" as const, alignItems: "flex-start" as const, justifyContent: "center" as const }
const styleObj2 = { originX: 0 }
const transition = { duration: .48, ease: [.76, 0, .24, 1] as [number, number, number, number] }
