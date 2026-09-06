import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"
import PhoneInput from "@modules/common/components/phone-input"
import React, { useState } from "react"
import s from "./style.module.scss"

const BillingAddress = ({ cart, countryCode }: { cart: HttpTypes.StoreCart | null, countryCode: string }) => {
  const routeCountry = countryCode.toLowerCase()
  const [formData, setFormData] = useState<any>({
    "billing_address.first_name": cart?.billing_address?.first_name || "",
    "billing_address.last_name": cart?.billing_address?.last_name || "",
    "billing_address.address_1": cart?.billing_address?.address_1 || "",
    "billing_address.company": cart?.billing_address?.company || "",
    "billing_address.postal_code": cart?.billing_address?.postal_code || "",
    "billing_address.city": cart?.billing_address?.city || "",
    "billing_address.country_code": routeCountry,
    "billing_address.province": cart?.billing_address?.province || "",
    "billing_address.phone": cart?.billing_address?.phone || "",
  })

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
    <div className={s.root}>
      <div className={s.formGrid}>
        <Input
          label="Jméno"
          name="billing_address.first_name"
          autoComplete="given-name"
          value={formData["billing_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="billing-first-name-input"
          className={s.input}
          variant="contact"
        />
        <Input
          label="Příjmení"
          name="billing_address.last_name"
          autoComplete="family-name"
          value={formData["billing_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="billing-last-name-input"
          className={s.input}
          variant="contact"
        />
        <Input
          label="Adresa"
          name="billing_address.address_1"
          autoComplete="address-line1"
          value={formData["billing_address.address_1"]}
          onChange={handleChange}
          required
          data-testid="billing-address-input"
          className={s.input}
          variant="contact"
        />
        <Input
          label="Společnost"
          name="billing_address.company"
          value={formData["billing_address.company"]}
          onChange={handleChange}
          autoComplete="organization"
          data-testid="billing-company-input"
          className={s.input}
          variant="contact"
        />
        <Input
          label="PSČ"
          name="billing_address.postal_code"
          autoComplete="postal-code"
          inputMode="numeric"
          value={formData["billing_address.postal_code"]}
          onChange={handleChange}
          required
          data-testid="billing-postal-input"
          className={s.input}
          variant="contact"
        />
        <Input
          label="Město"
          name="billing_address.city"
          autoComplete="address-level2"
          value={formData["billing_address.city"]}
          onChange={handleChange}
          className={s.input}
          variant="contact"
        />
        <div className={s.countryField}>
          <span>Země fakturace</span>
          <strong>{cart?.region?.countries?.find((country) => country.iso_2 === routeCountry)?.display_name || routeCountry.toUpperCase()}</strong>
        </div>
        <input
          type="hidden"
          name="billing_address.country_code"
          value={routeCountry}
          data-testid="billing-country-select"
        />
        {/* Kraj se v české verzi neptáme — určuje ho PSČ. Viz shipping-address. */}
        {routeCountry !== "cz" && (
          <Input
            label="Kraj / Okres"
            name="billing_address.province"
            autoComplete="address-level1"
            value={formData["billing_address.province"]}
            onChange={handleChange}
            data-testid="billing-province-input"
            className={s.input}
            variant="contact"
          />
        )}
        {/* Událost z PhoneInputu nese jen target.name/value — to, co handleChange čte. */}
        <PhoneInput
          label="Telefon"
          name="billing_address.phone"
          value={formData["billing_address.phone"]}
          onChange={(e) =>
            handleChange(e as React.ChangeEvent<HTMLInputElement>)
          }
          data-testid="billing-phone-input"
          className={s.input}
          variant="contact"
        />
      </div>
    </div>
  )
}

export default BillingAddress
