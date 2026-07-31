"use client"

import React, { useEffect, useState, useActionState } from "react"
import { clx, Divider } from "@medusajs/ui"
import { motion, AnimatePresence } from "framer-motion"

import useToggleState from "@lib/hooks/use-toggle-state"
import CountrySelect from "@modules/checkout/components/country-select"
import Input from "@modules/common/components/input"
import Modal from "@modules/common/components/modal"
import { HttpTypes } from "@medusajs/types"
import {
  deleteCustomerAddress,
  updateCustomerAddress,
} from "@lib/data/customer"
import s from "./styles.module.scss"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { accountBackdropVariants, accountModalVariants } from "../../motion"
import AccountInteractiveSurface from "../account-interactive-surface"

type EditAddressProps = {
  region: HttpTypes.StoreRegion
  address: HttpTypes.StoreCustomerAddress
  isActive?: boolean
}

const EditAddress: React.FC<EditAddressProps> = ({
  region,
  address,
  isActive = false,
}) => {
  const [removing, setRemoving] = useState(false)
  const [successState, setSuccessState] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const { state, open, close: closeModal } = useToggleState(false)

  const [formState, formAction] = useActionState(updateCustomerAddress, {
    success: false,
    error: null,
    addressId: address.id,
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

  const removeAddress = async () => {
    setRemoving(true)
    await deleteCustomerAddress(address.id)
    setRemoving(false)
  }

  return (
    <div className={s.editAddress}>
      <AccountInteractiveSurface
        className={clx(s.card, { [s.cardActive]: isActive })}
        contentClassName={s.cardContent}
      >
        <div className={s.cardDetails} data-testid="address-container">
          <h3 className={s.name} data-testid="address-name">
            {address.first_name} {address.last_name}
          </h3>
          {address.company && (
            <p className={s.company} data-testid="address-company">
              {address.company}
            </p>
          )}
          <p className={s.addressLines}>
            <span data-testid="address-address">
              {address.address_1}
              {address.address_2 && <span>, {address.address_2}</span>}
            </span>
            <span data-testid="address-postal-city">
              {address.postal_code}, {address.city}
            </span>
            <span data-testid="address-province-country">
              {address.province && `${address.province}, `}
              {address.country_code?.toUpperCase()}
            </span>
          </p>
        </div>
        <div className={s.actions}>
          <PremiumActionButton
            text="Upravit"
            className={s.linkBtn}
            onClickAction={open}
            compact
            data-testid="address-edit-button"
          />
          <PremiumActionButton
            text="Odstranit"
            className={s.linkBtn}
            onClickAction={() => setDeleteModalOpen(true)}
            compact
            data-testid="address-delete-button"
            disabled={removing}
          />
        </div>
      </AccountInteractiveSurface>

      <Modal isOpen={state} close={close} data-testid="edit-address-modal">
        <Modal.Title>
          <div className={s.modalTitleContent}>
            <h2 className={s.modalTitle}>Upravit adresu</h2>
            <Divider />
          </div>
        </Modal.Title>
        <form action={formAction}>
          <input type="hidden" name="addressId" value={address.id} />
          <Modal.Body>
            <div className={s.addressForm}>
              <div className={s.rowTwo}>
                <Input
                  variant="contact"
                  label="Jméno"
                  name="first_name"
                  required
                  autoComplete="given-name"
                  defaultValue={address.first_name || undefined}
                  data-testid="first-name-input"
                />
                <Input
                  variant="contact"
                  label="Příjmení"
                  name="last_name"
                  required
                  autoComplete="family-name"
                  defaultValue={address.last_name || undefined}
                  data-testid="last-name-input"
                />
              </div>
              <Input
                variant="contact"
                label="Společnost"
                name="company"
                autoComplete="organization"
                defaultValue={address.company || undefined}
                data-testid="company-input"
                className={s.input}
              />
              <Input
                variant="contact"
                label="Adresa"
                name="address_1"
                required
                autoComplete="address-line1"
                defaultValue={address.address_1 || undefined}
                data-testid="address-1-input"
              />
              <Input
                variant="contact"
                label="Bytová jednotka, patro, apod."
                name="address_2"
                autoComplete="address-line2"
                defaultValue={address.address_2 || undefined}
                data-testid="address-2-input"
              />
              <div className={s.rowPostal}>
                <Input
                  variant="contact"
                  label="PSČ"
                  name="postal_code"
                  required
                  autoComplete="postal-code"
                  defaultValue={address.postal_code || undefined}
                  data-testid="postal-code-input"
                />
                <Input
                  variant="contact"
                  label="Město"
                  name="city"
                  required
                  autoComplete="locality"
                  defaultValue={address.city || undefined}
                  data-testid="city-input"
                />
              </div>
              <Input
                variant="contact"
                label="Kraj / Okres"
                name="province"
                autoComplete="address-level1"
                defaultValue={address.province || undefined}
                data-testid="state-input"
              />
              <CountrySelect
                variant="contact"
                name="country_code"
                region={region}
                required
                autoComplete="country"
                defaultValue={address.country_code || undefined}
                data-testid="country-select"
              />
              <Input
                variant="contact"
                label="Telefon"
                name="phone"
                autoComplete="phone"
                defaultValue={address.phone || undefined}
                data-testid="phone-input"
              />
            </div>
            {formState.error && (
              <div className={s.error}>{formState.error}</div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <div className={s.actionsRow}>
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

      <AnimatePresence mode="wait">
        {deleteModalOpen && (
          <motion.div
            variants={accountBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={s.deleteModal}
            data-testid="delete-address-modal"
          >
            <motion.div
              className={s.modal}
              variants={accountModalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <h2>Odstranit adresu</h2>
              <p>
                Opravdu chcete odstranit tuto adresu? Tuto akci nelze vrátit
                zpět.
              </p>
              <div className={s.modalActions}>
                <PremiumActionButton
                  text="Zrušit"
                  onClickAction={() => setDeleteModalOpen(false)}
                  className={s.cancelBtn}
                />
                <PremiumActionButton
                  text="Odstranit"
                  onClickAction={async () => {
                    setDeleteModalOpen(false)
                    await removeAddress()
                  }}
                  className={s.deleteBtn}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default EditAddress
