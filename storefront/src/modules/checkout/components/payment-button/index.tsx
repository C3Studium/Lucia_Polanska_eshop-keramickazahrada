"use client"

import { isManual, isComgate } from "@lib/constants"
import { placeOrder } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
// Button from @medusajs/ui replaced with local ClickButton
import React, { useState } from "react"
import ErrorMessage from "../error-message"
import { redirect } from "next/navigation"
import styles from "./style.module.scss"
import { useFormStatus } from "react-dom"

import { motion } from "framer-motion";

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string,
  countryCode: string
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  countryCode,
  "data-testid": dataTestId,
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
        <ManualTestPaymentButton notReady={notReady} data-testid={dataTestId} />
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
            <ClickButton text="Vyberte způsob platby" disabled={true} />
          </div>
      )
  }
}

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = () => {
    setSubmitting(true)

    onPaymentCompleted()
  }

  return (
    <div className={styles.root} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center" }}>
      <ClickButton
        className={styles.button}
        text="Potvrdit objednávku"
        onClickAction={handlePayment}
        disabled={notReady}
        data-testid="submit-order-button"
      />
      <div className={styles.errorWrap}>
        <ErrorMessage
          error={errorMessage}
          data-testid="manual-payment-error-message"
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
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )
  const country_code = cart?.shipping_address?.country_code?.toLowerCase?.()

  const redirectUrl: string | undefined =
    typeof session?.data?.redirectUrl === "string"
      ? session.data.redirectUrl
      : typeof session?.provider_id === "string"
      ? session.provider_id
      : undefined

  const handlePayment = () => {
    if (!redirectUrl) {
      setErrorMessage(
        "Platební bránu se nepodařilo otevřít. Zkuste to prosím znovu, nebo nám napište na info@keramickazahrada.cz."
      )
      return
    }

    // Otevře URL v novém okně, nebo můžeš redirectnout přímo
    window.location.href = redirectUrl

    if (window.addEventListener) {
        window.addEventListener('message', async function (e) {
            // validace, že message obsahuje data
            if (!e || !(e !== null && e !== void 0 && e.data)) return;
            const { status } = e.data;
            if (!['PAID', 'AUTHORIZED'].includes(status)) {
                redirect(`/${country_code}/cart/${cart.id}/canceled`)
            }
        }, false);
    }
  }

  return (
    <div className={styles.root} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center" }}>
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
                style={{ originX: 0 }}
                transition={{ duration: .48, ease: [.76, 0, .24, 1] }}
              />
              <span className={styles.label}>{text}</span>
          </motion.button>
      </div>
  )
}
