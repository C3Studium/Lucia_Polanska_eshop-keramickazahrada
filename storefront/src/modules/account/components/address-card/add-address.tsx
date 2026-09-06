"use client"

import { Divider, Text } from "@medusajs/ui"
import { useEffect, useState, useActionState } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"
import CountrySelect from "@modules/checkout/components/country-select"
import Input from "@modules/common/components/input"
import PhoneInput from "@modules/common/components/phone-input"
import Modal from "@modules/common/components/modal"
import { HttpTypes } from "@medusajs/types"
import { addCustomerAddress } from "@lib/data/customer"
import s from "./add-address.module.scss"
import PremiumActionButton from "@modules/common/components/premium-action-button"

const AddAddress = ({
  region,
  addresses,
}: {
  region: HttpTypes.StoreRegion
  addresses: HttpTypes.StoreCustomerAddress[]
}) => {
  const [successState, setSuccessState] = useState(false)
  const { state, open, close: closeModal } = useToggleState(false)

  const [formState, formAction] = useActionState(addCustomerAddress, {
    isDefaultShipping: addresses.length === 0,
    success: false,
    error: null,
  })

  const close = () => {
    setSuccessState(false)
    closeModal()
  }

  useEffect(() => {
    if (successState) {
      close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successState])

  useEffect(() => {
    if (formState.success) {
      setSuccessState(true)
    }
  }, [formState])

  return (
    <>
      <div className={s.addButtonContainer}>
        <div className={s.addButton}>
          <Text className={s.addressText}>Vaše adresy:</Text>
          <PremiumActionButton
            text="Nová adresa"
            className={s.cardButton}
            onClickAction={open}
            compact
            data-testid="add-address-button"
          />
        </div>
        <Divider />
      </div>

      <Modal isOpen={state} close={close} data-testid="add-address-modal">
        <Modal.Title>
          <div className={s.modalTitleContent}>
            <h2 className={s.modalTitle}>Přidat adresu</h2>
            <Divider />
          </div>
        </Modal.Title>
        <form action={formAction}>
          <Modal.Body>
            <div className={s.form}
            >
              <div className={s.rowTwo}>
                <Input
                  variant="contact"
                  label="Jméno"
                  name="first_name"
                  required
                  autoComplete="given-name"
                  data-testid="first-name-input"
                />
                <Input
                  variant="contact"
                  label="Příjmení"
                  name="last_name"
                  required
                  autoComplete="family-name"
                  data-testid="last-name-input"
                />
              </div>
              <Input
                variant="contact"
                label="Společnost"
                name="company"
                autoComplete="organization"
                data-testid="company-input"
              />
              <Input
                variant="contact"
                label="Adresa"
                name="address_1"
                required
                autoComplete="address-line1"
                data-testid="address-1-input"
              />
              <Input
                variant="contact"
                label="Bytová jednotka, patro, apod."
                name="address_2"
                autoComplete="address-line2"
                data-testid="address-2-input"
              />
              <div className={s.rowPostal}>
                <Input
                  variant="contact"
                  label="PSČ"
                  name="postal_code"
                  required
                  autoComplete="postal-code"
                  inputMode="numeric"
                  data-testid="postal-code-input"
                />
                <Input
                  variant="contact"
                  label="Město"
                  name="city"
                  required
                  autoComplete="locality"
                  data-testid="city-input"
                />
              </div>
              <Input
                variant="contact"
                label="Kraj / Okres"
                name="province"
                autoComplete="address-level1"
                data-testid="state-input"
              />
              <CountrySelect
                variant="contact"
                region={region}
                name="country_code"
                required
                autoComplete="country"
                data-testid="country-select"
              />
              <PhoneInput
                variant="contact"
                label="Telefon"
                name="phone"
                data-testid="phone-input"
              />
            </div>
            {formState.error && (
              <div className={s.error} role="alert" data-testid="address-error">
                {formState.error}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <div className={s.actions}>
              <PremiumActionButton
                text="Zrušit"
                type="button"
                onClickAction={close}
                className={s.cancelBtn}
                data-testid="cancel-button"
              />
              <PremiumActionButton
                text="Uložit"
                type="submit"
                className={s.saveBtn}
                data-testid="save-button"
              />
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  )
}

export default AddAddress
