import { HttpTypes } from "@medusajs/types"
import { motion, type Variants } from "framer-motion"
import Checkbox from "@modules/common/components/checkbox"
import Input from "@modules/common/components/input"
import PhoneInput from "@modules/common/components/phone-input"
import { mapKeys } from "lodash"
import React, { useEffect, useMemo, useState } from "react"
import AddressSelect from "../address-select"
import styles from "./style.module.scss"

/*
 * Nájezdová geometrie v jednotce toho, proti čemu se pohybuje.
 *
 * Blok stoupá proti obrazovce, takže jeho posun patří do vh, ne do px:
 * původních 12px čtených na referenčním okně vysokém 1080 je 12/1080 = 1.11vh
 * (8.5px na laptopu 768, 15px na desktopu 1351). Posun položek uvnitř si drží
 * poměr, který návrh měl — 8/12 — místo druhého ručně vybraného čísla.
 *
 * Obě strany interpolace nesou stejný tvar výrazu ("1.11vh" ↔ "0vh"); kdyby
 * cíl zůstal číslem 0, framer by míchal px s vh a animace by skočila.
 */
const PROMPT_RISE_VH = 1.11
/** Položka uvnitř bloku: 8/12 posunu bloku. */
const PROMPT_ITEM_RISE_VH = +(PROMPT_RISE_VH * (8 / 12)).toFixed(2) // 0.74

const savedAddressPromptVariants: Variants = {
  hidden: {
    opacity: 0,
    y: `${PROMPT_RISE_VH}vh`,
  },
  visible: {
    opacity: 1,
    y: "0vh",
    transition: {
      duration: 0.56,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.08,
      delayChildren: 0.06,
    },
  },
}

const savedAddressPromptItemVariants: Variants = {
  hidden: { opacity: 0, y: `${PROMPT_ITEM_RISE_VH}vh` },
  visible: {
    opacity: 1,
    y: "0vh",
    transition: {
      duration: 0.46,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

const ShippingAddress = ({
  customer,
  cart,
  checked,
  onChange,
  countryCode,
}: {
  customer: HttpTypes.StoreCustomer | null
  cart: HttpTypes.StoreCart | null
  checked: boolean
  onChange: () => void
  countryCode: string
}) => {
  const routeCountry = countryCode.toLowerCase()
  const [formData, setFormData] = useState<Record<string, any>>({
    "shipping_address.first_name": cart?.shipping_address?.first_name || "",
    "shipping_address.last_name": cart?.shipping_address?.last_name || "",
    "shipping_address.address_1": cart?.shipping_address?.address_1 || "",
    "shipping_address.company": cart?.shipping_address?.company || "",
    "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
    "shipping_address.city": cart?.shipping_address?.city || "",
    "shipping_address.country_code": routeCountry,
    "shipping_address.province": cart?.shipping_address?.province || "",
    "shipping_address.phone": cart?.shipping_address?.phone || "",
    email: cart?.email || "",
  })

  const countriesInRegion = useMemo(
    () => cart?.region?.countries?.map((c) => c.iso_2),
    [cart?.region]
  )

  // check if customer has saved addresses that are in the current region
  const addressesInRegion = useMemo(
    () =>
      customer?.addresses.filter(
        (a) => a.country_code && countriesInRegion?.includes(a.country_code)
      ),
    [customer?.addresses, countriesInRegion]
  )

  const setFormAddress = (
    address?: HttpTypes.StoreCartAddress,
    email?: string
  ) => {
    address &&
      setFormData((prevState: Record<string, any>) => ({
        ...prevState,
        "shipping_address.first_name": address?.first_name || "",
        "shipping_address.last_name": address?.last_name || "",
        "shipping_address.address_1": address?.address_1 || "",
        "shipping_address.company": address?.company || "",
        "shipping_address.postal_code": address?.postal_code || "",
        "shipping_address.city": address?.city || "",
        "shipping_address.country_code": routeCountry,
        "shipping_address.province": address?.province || "",
        "shipping_address.phone": address?.phone || "",
      }))

    email &&
      setFormData((prevState: Record<string, any>) => ({
        ...prevState,
        email: email,
      }))
  }

  useEffect(() => {
    // Ensure cart is not null and has a shipping_address before setting form data
    if (cart && cart.shipping_address) {
      setFormAddress(cart?.shipping_address, cart?.email)
    }

    if (cart && !cart.email && customer?.email) {
      setFormAddress(undefined, customer.email)
    }
  }, [cart, routeCountry]) // route country is the source of truth

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className={styles.root}>
      {customer && (addressesInRegion?.length || 0) > 0 && (
        <motion.section
          className={styles.addressPrompt}
          variants={savedAddressPromptVariants}
          initial="hidden"
          animate="visible"
          aria-labelledby="saved-addresses-heading"
        >
          <motion.div
            className={styles.addressPromptIntro}
            variants={savedAddressPromptItemVariants}
          >
            <span>Uložená místa · {String(addressesInRegion?.length).padStart(2, "0")}</span>
            <div>
              <h3 id="saved-addresses-heading">
                Vítejte zpět{customer.first_name ? `, ${customer.first_name}` : ""}.
              </h3>
              <p>Vyberte si uloženou adresu, nebo vyplňte novou níž.</p>
            </div>
          </motion.div>
          <motion.div
            className={styles.addressPromptSelect}
            variants={savedAddressPromptItemVariants}
          >
            <AddressSelect
              addresses={addressesInRegion || []}
              addressInput={
                mapKeys(formData, (_, key) =>
                  key.replace("shipping_address.", "")
                ) as HttpTypes.StoreCartAddress
              }
              onSelect={setFormAddress}
            />
          </motion.div>
        </motion.section>
      )}
      <div className={styles.formGrid}>
        <Input
          label="Jméno"
          name="shipping_address.first_name"
          autoComplete="given-name"
          value={formData["shipping_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-first-name-input"
          className={styles.input}
          variant="contact"
        />
        <Input
          label="Příjmení"
          name="shipping_address.last_name"
          autoComplete="family-name"
          value={formData["shipping_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-last-name-input"
          className={styles.input}
          variant="contact"
        />
        <Input
          label="Adresa"
          name="shipping_address.address_1"
          autoComplete="address-line1"
          value={formData["shipping_address.address_1"]}
          onChange={handleChange}
          required
          data-testid="shipping-address-input"
          className={styles.input}
          variant="contact"
        />
        <Input
          label="Společnost"
          name="shipping_address.company"
          value={formData["shipping_address.company"]}
          onChange={handleChange}
          autoComplete="organization"
          data-testid="shipping-company-input"
          className={styles.input}
          variant="contact"
        />
        <Input
          label="PSČ"
          name="shipping_address.postal_code"
          autoComplete="postal-code"
          inputMode="numeric"
          value={formData["shipping_address.postal_code"]}
          onChange={handleChange}
          required
          data-testid="shipping-postal-code-input"
          className={styles.input}
          variant="contact"
        />
        <Input
          label="Město"
          name="shipping_address.city"
          autoComplete="address-level2"
          value={formData["shipping_address.city"]}
          onChange={handleChange}
          required
          data-testid="shipping-city-input"
          className={styles.input}
          variant="contact"
        />
        <div className={styles.countryField}>
          <span className={styles.countryLabel}>Země doručení</span>
          <strong>{cart?.region?.countries?.find((country) => country.iso_2 === routeCountry)?.display_name || routeCountry.toUpperCase()}</strong>
          <span>Podle verze obchodu, kterou máte zvolenou</span>
        </div>
        <input
          type="hidden"
          name="shipping_address.country_code"
          value={routeCountry}
          data-testid="shipping-country-select"
        />
        {/*
          * Kraj se v české verzi obchodu neptáme — PSČ ho určuje samo a
          * dopravci ho z něj čtou. Je to políčko navíc na formuláři, který je
          * na telefonu stejně nejdelší částí pokladny.
          *
          * Zemi drží adresa (`routeCountry`), ne výběr ve formuláři, takže se
          * to za běhu nemůže změnit — a na `/sk`, `/de` a dalších verzích, kde
          * kraj něco znamená, pole zůstává.
          */}
        {routeCountry !== "cz" && (
          <Input
            label="Kraj / Okres"
            name="shipping_address.province"
            autoComplete="address-level1"
            value={formData["shipping_address.province"]}
            onChange={handleChange}
            data-testid="shipping-province-input"
            className={styles.input}
            variant="contact"
          />
        )}
      </div>
      <div className={styles.checkboxRow}>
        <Checkbox
          label="Fakturační adresa je stejná jako dodací adresa"
          name="same_as_billing"
          checked={checked}
          onChange={onChange}
          data-testid="billing-address-checkbox"
        />
      </div>
      <div className={styles.contactGrid}>
        <Input
          label="E-mail"
          name="email"
          type="email"
          title="Enter a valid email address."
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          required
          data-testid="shipping-email-input"
          className={styles.input}
          variant="contact"
        />
        {/* Událost z PhoneInputu nese jen target.name/value — přesně to,
            co handleChange čte; typ se proto jen zúží přetypováním. */}
        <PhoneInput
          label="Telefon"
          name="shipping_address.phone"
          value={formData["shipping_address.phone"]}
          onChange={(e) =>
            handleChange(e as React.ChangeEvent<HTMLInputElement>)
          }
          data-testid="shipping-phone-input"
          className={styles.input}
          variant="contact"
        />
      </div>
    </div>
  )
}

export default ShippingAddress
