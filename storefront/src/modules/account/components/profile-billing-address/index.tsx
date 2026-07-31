"use client"

import React, { useEffect, useMemo, useActionState } from "react"

import Input from "@modules/common/components/input"
import NativeSelect from "@modules/common/components/native-select"

import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { addCustomerAddress, updateCustomerAddress } from "@lib/data/customer"
import s from "./style.module.scss"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
  regions: HttpTypes.StoreRegion[]
}

const ProfileBillingAddress: React.FC<MyInformationProps> = ({
  customer,
  regions,
}) => {
  const regionOptions = useMemo(() => {
    return (
      regions
        ?.map((region) => {
          return region.countries?.map((country) => ({
            value: country.iso_2,
            label: country.display_name,
          }))
        })
        .flat() || []
    )
  }, [regions])

  const [successState, setSuccessState] = React.useState(false)

  const billingAddress = customer.addresses?.find(
    (addr) => addr.is_default_billing
  )

  const initialState: Record<string, any> = {
    isDefaultBilling: true,
    isDefaultShipping: false,
    error: false,
    success: false,
  }

  if (billingAddress) {
    initialState.addressId = billingAddress.id
  }

  const [state, formAction] = useActionState(
    billingAddress ? updateCustomerAddress : addCustomerAddress,
    initialState
  )

  const clearState = () => {
    setSuccessState(false)
  }

  useEffect(() => {
    setSuccessState(state.success)
  }, [state])

  const currentInfo = useMemo(() => {
    if (!billingAddress) {
      return "Žádná fakturační adresa"
    }

    const country =
      regionOptions?.find(
        (country) => country?.value === billingAddress.country_code
      )?.label || billingAddress.country_code?.toUpperCase()

    return (
      <div className={s.currentInfo} data-testid="current-info">
        <strong>
          {billingAddress.first_name} {billingAddress.last_name}
          {billingAddress.company ? ` · ${billingAddress.company}` : ""}
        </strong>
        <span>
          {billingAddress.address_1}
          {billingAddress.address_2 ? `, ${billingAddress.address_2}` : ""}
        </span>
        <span>
          {billingAddress.postal_code} {billingAddress.city} · {country}
        </span>
      </div>
    )
  }, [billingAddress, regionOptions])

  return (
    <form action={formAction} onReset={() => clearState()} className={s.root}>
      <input type="hidden" name="addressId" value={billingAddress?.id} />
      <AccountInfo
        label="Fakturační adresa"
        currentInfo={currentInfo}
        isSuccess={successState}
        isError={!!state.error}
        clearState={clearState}
        data-testid="account-billing-address-editor"
      >
        <div className={s.formGrid}>
          <div className={s.rowTwo}>
            <Input
              variant="contact"
              label="Jméno"
              name="first_name"
              defaultValue={billingAddress?.first_name || undefined}
              required
              data-testid="billing-first-name-input"
            />
            <Input
              variant="contact"
              label="Příjmení"
              name="last_name"
              defaultValue={billingAddress?.last_name || undefined}
              required
              data-testid="billing-last-name-input"
            />
          </div>
          <Input
            variant="contact"
            label="Společnost"
            name="company"
            defaultValue={billingAddress?.company || undefined}
            data-testid="billing-company-input"
          />
          <Input
            variant="contact"
            label="Adresa"
            name="address_1"
            defaultValue={billingAddress?.address_1 || undefined}
            required
            data-testid="billing-address-1-input"
          />
          <Input
            variant="contact"
            label="Bytová jednotka, patro, apod."
            name="address_2"
            defaultValue={billingAddress?.address_2 || undefined}
            data-testid="billing-address-2-input"
          />
          <div className={s.rowPostal}>
            <Input
              variant="contact"
              label="PSČ"
              name="postal_code"
              defaultValue={billingAddress?.postal_code || undefined}
              required
              data-testid="billing-postcal-code-input"
            />
            <Input
              variant="contact"
              label="Město"
              name="city"
              defaultValue={billingAddress?.city || undefined}
              required
              data-testid="billing-city-input"
            />
          </div>
          <Input
            variant="contact"
            label="Kraj / Okres"
            name="province"
            defaultValue={billingAddress?.province || undefined}
            data-testid="billing-province-input"
          />
          <NativeSelect
            variant="contact"
            name="country_code"
            defaultValue={billingAddress?.country_code || undefined}
            required
            data-testid="billing-country-code-select"
          >
            <option value="">-</option>
            {regionOptions.map((option, i) => {
              return (
                <option key={i} value={option?.value}>
                  {option?.label}
                </option>
              )
            })}
          </NativeSelect>
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfileBillingAddress
