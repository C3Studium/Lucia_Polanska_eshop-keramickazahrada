"use client"

import { setShippingMethod } from "@lib/data/cart"
import {
  setExpressAddress,
  setExpressCartMetadata,
  type ExpressPrefillAddress,
} from "@lib/data/express-cart"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { convertToLocale } from "@lib/util/money"
import { withCount } from "@lib/util/plurals"
import { HttpTypes } from "@medusajs/types"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import styles from "../style.module.scss"

type ShippingProps = {
  cart: HttpTypes.StoreCart
  region: HttpTypes.StoreRegion
  countryCode: string
  shippingMethods: HttpTypes.StoreCartShippingOption[]
  packetaApiKey?: string
  packetaShippingMethodId?: string
  /** Saved address of a logged-in customer — fills empty fields, never overwrites the cart's. */
  prefillAddress?: ExpressPrefillAddress | null
  onContinueAction: () => void
}

type AddressState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  postalCode: string
  city: string
}

export const Shipping = ({
  cart,
  region,
  countryCode,
  shippingMethods,
  packetaApiKey,
  packetaShippingMethodId,
  prefillAddress,
  onContinueAction,
}: ShippingProps) => {
  const current = cart.shipping_address
  /* What the cart already knows wins; a logged-in customer's saved address
     fills the rest — the account should never be asked to retype itself. */
  const [address, setAddress] = useState<AddressState>({
    firstName: current?.first_name || prefillAddress?.firstName || "",
    lastName: current?.last_name || prefillAddress?.lastName || "",
    email: cart.email || prefillAddress?.email || "",
    phone: current?.phone || prefillAddress?.phone || "",
    address: current?.address_1 || prefillAddress?.address || "",
    postalCode: current?.postal_code || prefillAddress?.postalCode || "",
    city: current?.city || prefillAddress?.city || "",
  })
  const [shippingMethodId, setShippingMethodId] = useState(
    cart.shipping_methods?.at(-1)?.shipping_option_id || ""
  )
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [packetaPoint, setPacketaPoint] = useState<string>(
    String(cart.metadata?.packeta_pickup_point_label || "")
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const calculated = shippingMethods.filter(
      (method) => method.price_type === "calculated"
    )
    if (!calculated.length) return

    Promise.all(
      calculated.map(async (method) => {
        const priced = await calculatePriceForShippingOption(method.id, cart.id)
        return [method.id, priced?.amount] as const
      })
    ).then((entries) => {
      setPrices(
        entries.reduce((result, [id, amount]) => {
          if (typeof amount === "number") result[id] = amount
          return result
        }, {} as Record<string, number>)
      )
    })
  }, [cart.id, shippingMethods])

  const selectedMethod = shippingMethods.find(
    (method) => method.id === shippingMethodId
  )
  const isPacketa = shippingMethodId === packetaShippingMethodId

  /* A single offered delivery is no choice at all — preselect it (still shown,
     still changeable). Packeta is exempt: preselecting it would pop the pickup
     point widget at nobody's request. */
  useEffect(() => {
    if (shippingMethodId || shippingMethods.length !== 1) return
    const only = shippingMethods[0]
    if (only.id === packetaShippingMethodId) return
    setShippingMethodId(only.id)
  }, [shippingMethodId, shippingMethods, packetaShippingMethodId])

  const valid = useMemo(
    () =>
      Object.values(address).every((value) => value.trim().length > 0) &&
      !!shippingMethodId &&
      (!isPacketa || !!packetaPoint),
    [address, shippingMethodId, isPacketa, packetaPoint]
  )

  const countryLabel =
    region.countries?.find(
      (country) => country.iso_2?.toLowerCase() === countryCode.toLowerCase()
    )?.display_name || countryCode.toUpperCase()

  const updateField = (field: keyof AddressState, value: string) => {
    setAddress((previous) => ({ ...previous, [field]: value }))
  }

  const openPacketa = () => {
    setError(null)
    if (!packetaApiKey) {
      setError("Výběr výdejního místa se nám nepovedlo spustit. Napište nám prosím.")
      return
    }

    const choose = () => {
      if (!window.Packeta?.Widget) return
      window.Packeta.Widget.pick(
        packetaApiKey,
        async (point: any) => {
          if (!point) return
          const label =
            point.formatedValue || point.name || point.address || String(point.id)
          const result = await setExpressCartMetadata(cart.id, {
            packeta_pickup_point: point.id,
            packeta_pickup_point_label: label,
          })
          if (!result.success) {
            setError(result.message || "Výdejní místo se nepovedlo uložit.")
            return
          }
          setPacketaPoint(label)
        },
        {
          language: "cs",
          valueFormat:
            '"Packeta",id,carrierId,carrierPickupPointId,name,city,street',
          view: "modal",
          vendors: [
            { country: "cz" },
            { country: "sk" },
            { country: "hu" },
            { country: "pl" },
            { country: "ro" },
            { country: "cz", group: "zbox" },
            { country: "sk", group: "zbox" },
          ],
        }
      )
    }

    if (window.Packeta?.Widget) {
      choose()
      return
    }

    let script = document.getElementById(
      "packeta-widget-script"
    ) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement("script")
      script.id = "packeta-widget-script"
      script.src = "https://widget.packeta.com/v6/www/js/library.js"
      script.async = true
      document.body.appendChild(script)
    }
    script.addEventListener("load", choose, { once: true })
    script.addEventListener(
      "error",
      () => setError("Mapu výdejních míst se nepovedlo načíst."),
      { once: true }
    )
  }

  const submitWith = async (methodId: string) => {
    const addressComplete = Object.values(address).every(
      (value) => value.trim().length > 0
    )
    const needsPacketaPoint =
      methodId === packetaShippingMethodId && !packetaPoint

    if (!methodId || !addressComplete || needsPacketaPoint || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    const addressResult = await setExpressAddress({
      cartId: cart.id,
      countryCode,
      data: address,
    })

    if (!addressResult.success) {
      setError(addressResult.message || "Adresu se nepovedlo uložit.")
      setIsSubmitting(false)
      return
    }

    const shippingResult = await setShippingMethod({
      cartId: cart.id,
      shippingMethodId: methodId,
    })

    setIsSubmitting(false)
    if (!shippingResult.success) {
      setError(shippingResult.message || "Dopravu se nepovedlo uložit.")
      return
    }

    onContinueAction()
  }

  const submit = () => submitWith(shippingMethodId)

  /**
   * Clicking a delivery option when the address is already complete is the last
   * act this step needs — save and move on; a further „Pokračovat" click would
   * buy nothing. With the address still unfinished (or Packeta, which first
   * needs its pickup point), the click only selects and the button stays.
   */
  const chooseMethod = (methodId: string) => {
    setShippingMethodId(methodId)
    if (methodId === packetaShippingMethodId) {
      openPacketa()
      return
    }
    void submitWith(methodId)
  }

  return (
    <div className={styles.deliveryStep}>
      <div className={styles.sectionIntro}>
        <span className={styles.eyebrow}>Kam to poslat</span>
        <p>
          Vyplňte prosím kontaktní údaje a vyberte způsob doručení. Zemi
          doručení není třeba vybírat — je nastavená automaticky.
        </p>
      </div>

      <div className={styles.fields}>
        <Field
          label="Jméno"
          name="given-name"
          autoComplete="given-name"
          value={address.firstName}
          onChangeAction={(value) => updateField("firstName", value)}
        />
        <Field
          label="Příjmení"
          name="family-name"
          autoComplete="family-name"
          value={address.lastName}
          onChangeAction={(value) => updateField("lastName", value)}
        />
        <Field
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          value={address.email}
          onChangeAction={(value) => updateField("email", value)}
          wide
        />
        <Field
          label="Telefon"
          type="tel"
          name="tel"
          autoComplete="tel"
          value={address.phone}
          onChangeAction={(value) => updateField("phone", value)}
          wide
        />
        <Field
          label="Ulice a číslo"
          name="street-address"
          autoComplete="street-address"
          value={address.address}
          onChangeAction={(value) => updateField("address", value)}
          wide
        />
        <Field
          label="PSČ"
          name="postal-code"
          autoComplete="postal-code"
          inputMode="numeric"
          value={address.postalCode}
          onChangeAction={(value) => updateField("postalCode", value)}
        />
        <Field
          label="Město"
          name="address-level2"
          autoComplete="address-level2"
          value={address.city}
          onChangeAction={(value) => updateField("city", value)}
        />
        <div className={`${styles.field} ${styles.countryField}`}>
          <span>Země doručení</span>
          <strong>{countryLabel}</strong>
          <small>Nastaveno automaticky</small>
        </div>
      </div>

      <div className={styles.methodSection}>
        <div className={styles.methodHeading}>
          <span className={styles.eyebrow}>Způsob doručení</span>
          <span>
            {withCount(shippingMethods.length, "možnost", "možnosti", "možností")}
          </span>
        </div>
        <div
          className={styles.methodList}
          role="group"
          aria-label="Způsob doručení"
        >
          {shippingMethods.map((method) => {
            const selected = method.id === shippingMethodId
            const amount =
              method.price_type === "flat" ? method.amount : prices[method.id]
            return (
              <motion.button
                type="button"
                key={method.id}
                className={styles.method}
                data-selected={selected}
                aria-pressed={selected}
                onClick={() => chooseMethod(method.id)}
                whileTap={whileTap}
              >
                <span className={styles.methodFill} aria-hidden="true" />
                <span className={styles.radioMark}>
                  <span />
                </span>
                <span className={styles.methodCopy}>
                  <strong>{method.name}</strong>
                  <small>
                    {method.id === packetaShippingMethodId
                      ? packetaPoint || "Výdejní místo si vyberete vzápětí"
                      : "Doručení na uvedenou adresu"}
                  </small>
                </span>
                <span className={styles.methodPrice}>
                  {typeof amount === "number"
                    ? convertToLocale({
                        amount,
                        currency_code: cart.currency_code,
                      })
                    : "—"}
                </span>
              </motion.button>
            )
          })}
        </div>
        {isPacketa && (
          <button
            type="button"
            className={styles.packetaEdit}
            onClick={openPacketa}
          >
            {packetaPoint ? "Změnit výdejní místo" : "Vybrat výdejní místo"} ↗
          </button>
        )}
      </div>

      <PremiumActionButton
        text={
          isSubmitting
            ? "Ukládáme…"
            : selectedMethod
              ? "Pokračovat k platbě"
              : "Vyberte dopravu"
        }
        disabled={!valid || isSubmitting}
        onClickAction={submit}
        className={styles.fullAction}
      />

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

const Field = ({
  label,
  type = "text",
  name,
  autoComplete,
  inputMode,
  value,
  onChangeAction,
  wide = false,
}: {
  label: string
  type?: string
  name: string
  autoComplete: string
  inputMode?: "numeric" | "tel" | "email"
  value: string
  onChangeAction: (value: string) => void
  wide?: boolean
}) => (
  <label className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
    <span>{label}</span>
    <input
      required
      type={type}
      name={name}
      autoComplete={autoComplete}
      inputMode={inputMode}
      value={value}
      onChange={(event) => onChangeAction(event.target.value)}
    />
  </label>
)


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const whileTap = { scale: .99 }
/* 4/1080 = .37vh — screen-relative drop-in, same unit on both ends. */
const initial = { opacity: 0, y: "-0.37vh" }
const animate = { opacity: 1, y: "0vh" }
const exit = { opacity: 0 }
