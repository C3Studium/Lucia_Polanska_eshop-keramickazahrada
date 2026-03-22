"use client"

import React, { useEffect, useState, useActionState } from "react"
import { PencilSquare as Edit, Trash } from "@medusajs/icons"
import { clx, Divider } from "@medusajs/ui"
import { motion, AnimatePresence } from "framer-motion"
import { useFormStatus } from "react-dom"

import useToggleState from "@lib/hooks/use-toggle-state"
import CountrySelect from "@modules/checkout/components/country-select"
import Input from "@modules/common/components/input"
import Modal from "@modules/common/components/modal"
import Spinner from "@modules/common/icons/spinner"
import { HttpTypes } from "@medusajs/types"
import {
  deleteCustomerAddress,
  updateCustomerAddress,
} from "@lib/data/customer"
import s from "./styles.module.scss"

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
      <div
        className={clx(s.card, { [s.cardActive]: isActive })}
        data-testid="address-container"
      >
        <div className="flex flex-col">
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
          <ScrollButton
            text="Upravit"
            className={s.linkBtn}
            onClickAction={open}
            data-testid="address-edit-button"
            component={<Edit />}
          />
          <ScrollButton
            text="Odstranit"
            className={s.linkBtn}
            onClickAction={() => setDeleteModalOpen(true)}
            data-testid="address-delete-button"
            component={removing ? <Spinner /> : <Trash />}
          />
        </div>
      </div>

      <Modal isOpen={state} close={close} data-testid="edit-address-modal">
        <Modal.Title>
          <div className={s.modalTitleContent}>
            <h2 className={s.modalTitle}>Upravit adresu</h2>
          < Divider />
          </div>
        </Modal.Title>
        <form action={formAction}>
          <input type="hidden" name="addressId" value={address.id} />
          <Modal.Body>
            <div className={s.addressForm}>
              <div className={s.rowTwo}>
                <Input
                  label="Jméno"
                  name="first_name"
                  required
                  autoComplete="given-name"
                  defaultValue={address.first_name || undefined}
                  data-testid="first-name-input"
                />
                <Input
                  label="Příjmení"
                  name="last_name"
                  required
                  autoComplete="family-name"
                  defaultValue={address.last_name || undefined}
                  data-testid="last-name-input"
                />
              </div>
              <Input
                label="Společnost"
                name="company"
                autoComplete="organization"
                defaultValue={address.company || undefined}
                data-testid="company-input"
                className={s.input}
              />
              <Input
                label="Adresa"
                name="address_1"
                required
                autoComplete="address-line1"
                defaultValue={address.address_1 || undefined}
                data-testid="address-1-input"
              />
              <Input
                label="Bytová jednotka, patro, apod."
                name="address_2"
                autoComplete="address-line2"
                defaultValue={address.address_2 || undefined}
                data-testid="address-2-input"
              />
              <div className={s.rowPostal}>
                <Input
                  label="PSČ"
                  name="postal_code"
                  required
                  autoComplete="postal-code"
                  defaultValue={address.postal_code || undefined}
                  data-testid="postal-code-input"
                />
                <Input
                  label="Město"
                  name="city"
                  required
                  autoComplete="locality"
                  defaultValue={address.city || undefined}
                  data-testid="city-input"
                />
              </div>
              <Input
                label="Kraj / Okres"
                name="province"
                autoComplete="address-level1"
                defaultValue={address.province || undefined}
                data-testid="state-input"
              />
              <CountrySelect
                name="country_code"
                region={region}
                required
                autoComplete="country"
                defaultValue={address.country_code || undefined}
                data-testid="country-select"
              />
              <Input
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
              <ClickButton
                text="Zrušit"
                type="button"
                onClickAction={close}
                className={s.cancelBtn}
                data-testid="cancel-button"
              />
              <ClickButton
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={s.deleteModal}
            data-testid="delete-address-modal"
          >
            <div className={s.modal}>
              <h2>Odstranit adresu</h2>
              <p>Opravdu chcete odstranit tuto adresu? Tuto akci nelze vrátit zpět.</p>
              <div className={s.modalActions}>
                <ClickButton
                  text="Zrušit"
                  onClickAction={() => setDeleteModalOpen(false)}
                  className={s.cancelBtn}
                />
                <ClickButton
                  text="Odstranit"
                  onClickAction={async () => {
                    setDeleteModalOpen(false);
                    await removeAddress();
                  }}
                  className={s.deleteBtn}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default EditAddress



function ScrollButton({
  text,
  className,
  textColor,
  "data-testid": dataTestId,
  onClickAction,
  component
}: {
  text: string;
  className?: string;
  textColor?: string;
  "data-testid"?: string;
  onClickAction?: () => void | Promise<void>;
  component?: React.ReactNode;
}) {
  return (
    <div className={`${className} ${s.ScrollLink}`} data-testid={dataTestId} onClick={onClickAction} style={{ cursor: 'pointer' }}>
        <button
          className={s.button}
            style={{
            textDecoration: "none",
          }}
        >
            <div className={s.slider}>
                <div className={s.el}>
                    <PerspectiveText label={text} className={className} textColor={textColor} component={component}/>
                </div>
                <div className={s.el}>
                    <PerspectiveText label={text} className={className} textColor={textColor} component={component}/>
                </div>
            </div>
        </button>
    </div>
  );
}

function PerspectiveText({label, className, textColor, component}: {label: string; className?: string; textColor?: string, component?: React.ReactNode}) {
  return (    
    <div className={s.perspectiveText}>
        <p 
          className={className}
          style={{
            color: textColor,
          }}
        >
          {label}
          {component}
        </p>
        <p 
          className={className}
          style={{
            color: textColor,
          }}
        >
          {label}
          {component}
        </p>
    </div>
  )
}

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
  const [ isActive , setIsActive ] = useState<boolean>(false);
  const { pending } = useFormStatus();
  const isSubmitting = type === "submit" ? pending : false;
  const isDisabled = disabled || isSubmitting;
  const handleClick = onClickAction ?? ClickAction;

  return (
    <div className={className ? `${s.ClickButton} ${className}` : s.ClickButton}>
      <button
        type={type}
        className={s.button}
        onClick={handleClick}
        disabled={isDisabled}
        aria-busy={isDisabled || undefined}
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
        data-testid={dataTestId}
      >
        <motion.div
          className={s.slider}
          animate={{top: isActive ? "-100%" : "0%"}}
          transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
        >
          <div
            className={s.el}
            style={{ backgroundColor: "var(--darkOlive)" }}
          >
            <PerspectiveText label={text}/>
          </div>
          <div
            className={s.el}
            style={{ backgroundColor: "var(--bgBlack)" }}
          >
            <PerspectiveText label={text} />
          </div>
        </motion.div>
      </button>
    </div>
  )
}
