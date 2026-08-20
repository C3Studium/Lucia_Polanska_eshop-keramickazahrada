"use client"

import { isComgate, TERMS_VERSION } from "@lib/constants"
import { initiatePaymentSession } from "@lib/data/cart"
import { setExpressCartMetadata } from "@lib/data/express-cart"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  extractComgateRedirectUrl,
  fromComgateOptionId,
  toComgateOptionId,
  type ComgatePaymentMethod,
} from "@lib/util/comgate"
import { convertToLocale } from "@lib/util/money"
import {
  readLastPaymentMethod,
  rememberLastPaymentMethod,
} from "@lib/util/payment-preference"
import { HttpTypes } from "@medusajs/types"
import ComgatePaymentSelector from "@modules/common/components/comgate-payment-selector"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"
import styles from "../style.module.scss"

type PaymentProps = {
  cart: HttpTypes.StoreCart
  paymentMethods: HttpTypes.StorePaymentProvider[]
  comgateMethods: ComgatePaymentMethod[]
  countryCode: string
  handle: string
}

const legacyComgateMethods = [
  { id: "pp_comgate_card", method: "CARD_ALL" },
  { id: "pp_comgate_applepay", method: "APPLEPAY_REDIRECT" },
  { id: "pp_comgate_googlepay", method: "GOOGLEPAY_REDIRECT" },
  { id: "pp_comgate_bank", method: "BANK_ALL" },
]

const methodForOption = (id: string) =>
  fromComgateOptionId(id) ||
  legacyComgateMethods.find((method) => method.id === id)?.method ||
  "ALL"

const legacyOptionForMethod = (method: string) => {
  if (method.includes("APPLE")) return "pp_comgate_applepay"
  if (method.includes("GOOGLE")) return "pp_comgate_googlepay"
  if (method.includes("BANK")) return "pp_comgate_bank"
  return "pp_comgate_card"
}

export const Payment = ({
  cart,
  paymentMethods,
  comgateMethods,
  countryCode,
  handle,
}: PaymentProps) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (session) => session.status === "pending"
  )
  const activeComgateMethod = String(activeSession?.data?.method || "")
  const activeMethod = isComgate(activeSession?.provider_id)
    ? comgateMethods.some((method) => method.id === activeComgateMethod)
      ? toComgateOptionId(activeComgateMethod)
      : legacyOptionForMethod(activeComgateMethod)
    : ""

  const [selected, setSelected] = useState(activeMethod)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /* The last method this browser paid with, restored as a *preselection* after
     mount (localStorage is client-only). The selector renders once this has
     settled, so it opens straight in its „Vybrali jste" state — confirm still
     required, consent still required. */
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    setSelected((current) => {
      if (current) return current
      const stored = readLastPaymentMethod()
      return stored && isComgate(stored) ? stored : current
    })
    setRestored(true)
  }, [])
  /* §1826 ObčZ wants an affirmative act, not an implied sentence — the same
     checkbox contract as the main checkout, recorded before payment. */
  const [accepted, setAccepted] = useState(false)

  const comgateAvailable = paymentMethods.some((method) => isComgate(method.id))

  const shippingAddress = cart.shipping_address
  const ready =
    !!shippingAddress && !!cart.email && !!cart.shipping_methods?.length

  const pay = async (optionId: string) => {
    if (!ready || isSubmitting || !isComgate(optionId)) return
    if (!accepted) {
      setError("Potvrďte prosím souhlas s obchodními podmínkami.")
      return
    }

    setSelected(optionId)
    setIsSubmitting(true)
    setError(null)

    try {
      // The consent record must exist before the gateway takes over. Just the
      // patch — the action merges server-side against a fresh cart, so a stale
      // `cart.metadata` from this prop can never overwrite newer keys.
      await setExpressCartMetadata(cart.id, {
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
      })
      const shippingName = String(
        cart.shipping_methods?.at(-1)?.name || ""
      ).toLowerCase()
      const result = await initiatePaymentSession(cart, {
        provider_id: "pp_comgate_comgate",
        data: {
          email: cart.email,
          first_name: shippingAddress?.first_name,
          last_name: shippingAddress?.last_name,
          cart_id: cart.id,
          method: methodForOption(optionId),
          country_code: shippingAddress?.country_code || countryCode,
          billing_city: cart.billing_address?.city || shippingAddress?.city,
          billing_street:
            cart.billing_address?.address_1 || shippingAddress?.address_1,
          billing_postal_code:
            cart.billing_address?.postal_code || shippingAddress?.postal_code,
          shipping_city: shippingAddress?.city,
          shipping_street: shippingAddress?.address_1,
          shipping_postal_code: shippingAddress?.postal_code,
          delivery:
            shippingName.includes("zásil") ||
            shippingName.includes("zasil") ||
            shippingName.includes("packeta") ||
            shippingName.includes("výdej")
              ? "PICKUP"
              : "HOME_DELIVERY",
          lang: "cs",
          source: "express-checkout",
          return_path: `/${countryCode}/express-checkout/${handle}`,
        } as any,
      })

      if (!result.success) {
        throw new Error(
          result.message || "Platební bránu se nepovedlo otevřít."
        )
      }

      const redirectUrl = extractComgateRedirectUrl(result.data)
      if (!redirectUrl) {
        throw new Error("Platební brána se neozvala. Zkuste to prosím znovu.")
      }

      // The choice held all the way to the gateway — worth remembering.
      rememberLastPaymentMethod(optionId)
      window.location.assign(redirectUrl)
    } catch (paymentError: any) {
      setError(paymentError?.message || "Platbu se nepovedlo dokončit.")
      setIsSubmitting(false)
    }
  }

  const selectMethod = (optionId: string) => {
    if (isSubmitting) return
    setSelected(optionId)
    setError(null)
  }

  return (
    <div className={styles.paymentStep}>
      <div className={styles.orderMiniature}>
        <div className={styles.orderMiniatureHeader}>
          <span className={styles.eyebrow}>Co kupujete</span>
          <span>
            {cart.items?.reduce((sum, item) => sum + item.quantity, 0)} ks
          </span>
        </div>
        {cart.items?.map((item) => (
          <div className={styles.miniItem} key={item.id}>
            <Image
              src={item.thumbnail || "/assets/img/horizontal_prop.png"}
              alt=""
              width={58}
              height={58}
            />
            <div>
              <strong>{item.product_title || item.title}</strong>
              <small>
                {item.variant?.options
                  ?.map((option) => option.value)
                  .join(" · ")}
              </small>
            </div>
            <span>{item.quantity}×</span>
          </div>
        ))}
        <div className={styles.totalRows}>
          <span>
            <small>Výběr</small>
            <strong>
              {convertToLocale({
                amount: cart.item_subtotal || 0,
                currency_code: cart.currency_code,
              })}
            </strong>
          </span>
          <span>
            <small>Doručení</small>
            <strong>
              {convertToLocale({
                amount: cart.shipping_total || 0,
                currency_code: cart.currency_code,
              })}
            </strong>
          </span>
          <span className={styles.grandTotal}>
            <small>Celkem</small>
            <strong>
              {convertToLocale({
                amount: cart.total || 0,
                currency_code: cart.currency_code,
              })}
            </strong>
          </span>
        </div>
      </div>

      <div className={styles.methodSection}>
        <div className={styles.methodHeading}>
          <span className={styles.eyebrow}>Jak zaplatíte</span>
          <span>Šifrovaně a bezpečně</span>
        </div>
        <label className={styles.paymentConsent}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => {
              setAccepted(event.target.checked)
              if (event.target.checked) setError(null)
            }}
            data-testid="express-terms-checkbox"
          />{" "}
          <span>
            Souhlasím s{" "}
            <LocalizedClientLink href="/smluvni-podminky" target="_blank">
              obchodními podmínkami
            </LocalizedClientLink>{" "}
            a beru na vědomí{" "}
            <LocalizedClientLink href="/ochrana-osobnich-udaju" target="_blank">
              zpracování osobních údajů
            </LocalizedClientLink>
            .
          </span>
        </label>
        <div aria-busy={isSubmitting}>
          {!comgateAvailable && (
            <p className={styles.paymentUnavailable} role="alert">
              Comgate teď není dostupný. Zkuste to prosím za chvíli znovu — nebo
              nákup dokončete přes{" "}
              <LocalizedClientLink href="/cart">běžný košík</LocalizedClientLink>
              .
            </p>
          )}
          {comgateAvailable && restored && (
            <ComgatePaymentSelector
              methods={comgateMethods}
              selectedOptionId={selected}
              onSelect={selectMethod}
              onConfirm={() => pay(selected)}
              disabled={!ready || isSubmitting || !accepted}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            className={styles.error}
            role="alert"
            initial={initial}
            animate={animate}
            exit={exit}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { opacity: 0, y: -4 }
const animate = { opacity: 1, y: 0 }
const exit = { opacity: 0 }
