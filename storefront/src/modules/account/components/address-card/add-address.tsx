"use client"

import { Plus } from "@medusajs/icons"
import { Divider, Text } from "@medusajs/ui"
import { useEffect, useState, useActionState } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"
import CountrySelect from "@modules/checkout/components/country-select"
import Input from "@modules/common/components/input"
import Modal from "@modules/common/components/modal"
import { HttpTypes } from "@medusajs/types"
import { addCustomerAddress } from "@lib/data/customer"
import s from "./add-address.module.scss"
import { useFormStatus } from "react-dom"
import { motion } from "framer-motion"



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
          <ScrollButton
            text="Nová adresa"
            className={s.cardButton}
            onClickAction={open}
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
                  label="Jméno"
                  name="first_name"
                  required
                  autoComplete="given-name"
                  data-testid="first-name-input"
                />
                <Input
                  label="Příjmení"
                  name="last_name"
                  required
                  autoComplete="family-name"
                  data-testid="last-name-input"
                />
              </div>
              <Input
                label="Společnost"
                name="company"
                autoComplete="organization"
                data-testid="company-input"
              />
              <Input
                label="Adresa"
                name="address_1"
                required
                autoComplete="address-line1"
                data-testid="address-1-input"
              />
              <Input
                label="Bytová jednotka, patro, apod."
                name="address_2"
                autoComplete="address-line2"
                data-testid="address-2-input"
              />
              <div className={s.rowPostal}>
                <Input
                  label="PSČ"
                  name="postal_code"
                  required
                  autoComplete="postal-code"
                  data-testid="postal-code-input"
                />
                <Input
                  label="Město"
                  name="city"
                  required
                  autoComplete="locality"
                  data-testid="city-input"
                />
              </div>
              <Input
                label="Kraj / Okres"
                name="province"
                autoComplete="address-level1"
                data-testid="state-input"
              />
              <CountrySelect
                region={region}
                name="country_code"
                required
                autoComplete="country"
                data-testid="country-select"
              />
              <Input
                label="Telefon"
                name="phone"
                autoComplete="phone"
                data-testid="phone-input"
              />
            </div>
            {formState.error && (
              <div className={s.error} data-testid="address-error">
                {formState.error}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <div className={s.actions}>
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
    </>
  )
}

export default AddAddress


function ScrollButton({
  text,
  className,
  textColor,
  "data-testid": dataTestId,
  onClickAction
}: {
  text: string;
  className?: string;
  textColor?: string;
  "data-testid"?: string;
  onClickAction?: () => void | Promise<void>;
}) {
  return (
    <div className={s.ScrollLink} data-testid={dataTestId}
      onClick={onClickAction}
    >
        <button 
          className={s.button}
            style={{
            textDecoration: "none",
          }}
        >
            <div className={s.slider}>
                <div className={s.el}>
                    <PerspectiveText component={<Plus />} label={text} className={className} textColor={textColor}/>
                </div>
                <div className={s.el}>
                    <PerspectiveText component={<Plus />} label={text} className={className} textColor={"var(--whiteText)"}/>
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
