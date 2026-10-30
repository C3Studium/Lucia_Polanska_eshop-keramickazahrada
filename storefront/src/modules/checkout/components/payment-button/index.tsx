"use client"

import { cartNeedsShipping } from "@lib/util/needs-shipping"
import {
  isComgate,
  isDobirkaPayment,
  isManual,
  isPickupPayment,
} from "@lib/constants"
import { initiatePaymentSession, placeOrder } from "@lib/data/cart"
import {
  zeroChargeCopy,
  ZERO_PAYMENT_PROVIDER,
} from "@lib/util/price-on-request"
import { HttpTypes } from "@medusajs/types"
// Button from @medusajs/ui replaced with local ClickButton
import React, { useState } from "react"
import ErrorMessage from "../error-message"
import { ORDER_BUTTON_LABEL } from "../legal-consent/labels"
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
  /** Kolik se teď platí, už naformátované („1 290 Kč"). U zakázky záloha. */
  amountLabel?: string
  /**
   * Cena po domluvě a k úhradě 0 (jen takový kus + osobní odběr): ComGate
   * 0 Kč nevezme, objednávka se dokončí s relací `pp_system_default` —
   * tlačítko si ji před dokončením založí samo, kdyby na košíku nebyla.
   */
  zeroCharge?: boolean
}

/*
 * Tlačítko má na všech cestách TENTÝŽ název „Objednávka zavazující k platbě"
 * (§ 1826a odst. 2 OZ). Čím a kdy se platí, říká věta pod ním — dřív to bylo
 * v názvu („Potvrdit — zaplatíte při převzetí"), a to zákonný požadavek
 * nesplňuje.
 */
const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  countryCode,
  "data-testid": dataTestId,
  onBeforePlaceAction,
  amountLabel,
  zeroCharge = false,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cartNeedsShipping(cart as any) && (cart.shipping_methods?.length ?? 0) < 1)

  const amount = amountLabel ? ` ${amountLabel}` : ""
  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  if (zeroCharge) {
    return (
      <DirectPlaceOrderButton
        notReady={notReady}
        /* Cena po domluvě se objednává závazně a platí až potom; košík
           pokrytý poukazem se prostě odesílá. Znění drží `zeroChargeCopy`,
           ať tlačítko a věta pod ním mluví o témže. */
        label={zeroChargeCopy(cart as any).button}
        note={zeroChargeCopy(cart as any).note}
        onBeforePlaceAction={async () => {
          await onBeforePlaceAction?.()
          if (paymentSession?.provider_id !== ZERO_PAYMENT_PROVIDER) {
            const result = await initiatePaymentSession(cart, {
              provider_id: ZERO_PAYMENT_PROVIDER,
            })
            if (!result.success) {
              throw new Error(
                result.message ||
                  "Objednávku se nepodařilo připravit. Zkuste to prosím znovu."
              )
            }
          }
        }}
        data-testid={dataTestId}
      />
    )
  }

  switch (true) {
    case isManual(paymentSession?.provider_id):
      return (
        <DirectPlaceOrderButton
          notReady={notReady}
          note={`Testovací platba${amount ? ` —${amount}` : ""}. Objednávka se založí bez skutečné platby.`}
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
          note={`Zaplatíte${amount} při vyzvednutí v ateliéru.`}
          onBeforePlaceAction={onBeforePlaceAction}
          data-testid={dataTestId}
        />
      )
    case isDobirkaPayment(paymentSession?.provider_id):
      return (
        <DirectPlaceOrderButton
          notReady={notReady}
          note={`Zaplatíte${amount} doručovateli při převzetí zásilky (dobírka).`}
          onBeforePlaceAction={onBeforePlaceAction}
          data-testid={dataTestId}
        />
      )
    case isComgate(paymentSession?.provider_id):
      return (
        <ComgatePaymentButton
          notReady={notReady}
          cart={cart}
          note={`Zaplatíte${amount} hned online přes platební bránu ComGate.`}
          onBeforePlaceAction={onBeforePlaceAction}
          data-testid={dataTestId}/>
      )
    default:
      // Nic neodesílá — jen zamčené místo, dokud není zvolená platba.
      return (
        <div className={styles.root}>
            <ClickButton text="Nejdřív vyberte platbu" disabled={true} />
          </div>
      )
  }
}

const DirectPlaceOrderButton = ({
  notReady,
  note,
  label = ORDER_BUTTON_LABEL,
  onBeforePlaceAction,
  "data-testid": dataTestId,
}: {
  notReady: boolean
  /** Věta pod tlačítkem: jak a kolik se platí. */
  note: string
  /** Název tlačítka — jinak „Objednávka zavazující k platbě". */
  label?: string
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
      <p className={styles.note} data-testid="submit-order-note">
        {note}
      </p>
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
  note,
  onBeforePlaceAction,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  note: string
  /** Záznam souhlasu — musí existovat dřív, než brána převezme platbu. */
  onBeforePlaceAction?: () => Promise<void>
  "data-testid"?: string
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState(false)
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

  const handlePayment = async () => {
    if (redirecting) return
    if (!redirectUrl) {
      setErrorMessage(
        "Platební bránu se nepovedlo otevřít. Zkuste to prosím znovu, nebo nám napište na info@keramickazahrada.cz."
      )
      return
    }
    setRedirecting(true)
    setErrorMessage(null)
    try {
      /* Záznam souhlasu PŘED přesměrováním — dřív tahle cesta (relace
         z dřívějška, bez `?method=`) souhlas k objednávce nezapsala vůbec.
         Metadata košíku platební relaci nezneplatní. */
      await onBeforePlaceAction?.()
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Objednávku se nepodařilo odeslat."
      )
      setRedirecting(false)
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
        text={redirecting ? "Přesměrováváme k platbě…" : ORDER_BUTTON_LABEL}
        onClickAction={handlePayment}
        disabled={notReady || !redirectUrl || redirecting}
        data-testid={dataTestId}
      />
      <p className={styles.note} data-testid="submit-order-note">
        {note}
      </p>
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
