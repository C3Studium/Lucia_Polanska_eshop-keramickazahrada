"use client"

import { setAddresses } from "@lib/data/cart"
import compareAddresses from "@lib/util/compare-addresses"
import { CheckCircleSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Heading, Text, useToggleState } from "@medusajs/ui"

import Divider from "@modules/common/components/divider"
import Spinner from "@modules/common/icons/spinner"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState, useState } from "react"
import BillingAddress from "../billing_address"
import ErrorMessage from "../error-message"
import ShippingAddress from "../shipping-address"
// SubmitButton replaced by local ClickButton defined below
import s from "./style.module.scss"
import { useFormStatus } from "react-dom"
import { motion } from "framer-motion";

const Addresses = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "address"

  const { state: sameAsBilling, toggle: toggleSameAsBilling } = useToggleState(
    cart?.shipping_address && cart?.billing_address
      ? compareAddresses(cart?.shipping_address, cart?.billing_address)
      : true
  )

  const handleEdit = () => {
    router.push(pathname + "?step=address")
  }

  const [message, formAction] = useActionState(setAddresses, null)

  return (
    <div className={s.root}>
      <div className={s.headerRow}>
        <Heading
          level="h2"
          className={s.heading}
        >
          Doručovací a fakturační adresa
          {!isOpen && <CheckCircleSolid />}
        </Heading>
        {!isOpen && cart?.shipping_address && (
          <ClickButton
            type="button"
            onClickAction={handleEdit}
            className={s.editBtn}
            data-testid="edit-address-button"
            text={"Upravit"}
          />
        )}
      </div>
      {isOpen ? (
        <form action={formAction} className={s.form}>
          <div className={s.shippingAddress}>
            <ShippingAddress
              customer={customer}
              checked={sameAsBilling}
              onChange={toggleSameAsBilling}
              cart={cart}
            />

            {!sameAsBilling && (
              <div className={s.billingAddress}>
                <h2
                  className={s.heading}
                >
                  Doručovací adresa
                </h2>

                <BillingAddress cart={cart} />
              </div>
            )}
            <ClickButton
              type="submit"
              className={s.submitBtn}
              data-testid="submit-address-button"
              text={"Pokračovat k doručení"}
            />
            <ErrorMessage error={message} data-testid="address-error-message" />
          </div>
        </form>
      ) : (
        <div className={s.summary}>
          <div className={s.row}>
            {cart && cart.shipping_address ? (
              <>
                <div className={s.col + " shipping"} data-testid="shipping-address-summary">
                  <Text className={s.label}>
                    Doručovací adresa
                  </Text>
                  <Text className={s.value}>
                    {cart.shipping_address.first_name} {cart.shipping_address.last_name}
                  </Text>
                  <Text className={s.value}>
                    {cart.shipping_address.address_1} {cart.shipping_address.address_2}
                  </Text>
                  <Text className={s.value}>
                    {cart.shipping_address.postal_code}, {cart.shipping_address.city}
                  </Text>
                  <Text className={s.value}>
                    {cart.shipping_address.country_code?.toUpperCase()}
                  </Text>
                </div>

                <div className={s.col + " contact"} data-testid="shipping-contact-summary">
                  <Text className={s.label}>
                    Kontaktní osoba
                  </Text>
                  <Text className={s.value}>
                    {cart.shipping_address.phone}
                  </Text>
                  <Text className={s.value}>
                    {cart.email}
                  </Text>
                </div>

                <div className={s.col + " billing"} data-testid="billing-address-summary">
                  <Text className={s.label}>
                    Fakturační adresa
                  </Text>

                  {sameAsBilling ? (
                    <Text className={s.note}>
                      Fakturační a doručovací adresa jsou stejné.
                    </Text>
                  ) : (
                    <>
                      <Text className={s.value}>
                        {cart.billing_address?.first_name} {cart.billing_address?.last_name}
                      </Text>
                      <Text className={s.value}>
                        {cart.billing_address?.address_1} {cart.billing_address?.address_2}
                      </Text>
                      <Text className={s.value}>
                        {cart.billing_address?.postal_code}, {cart.billing_address?.city}
                      </Text>
                      <Text className={s.value}>
                        {cart.billing_address?.country_code?.toUpperCase()}
                      </Text>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div>
                <Spinner />
              </div>
            )}
          </div>
        </div>
      )}
      <Divider className={s.divider} />
    </div>
  )
}

export default Addresses



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

function PerspectiveText({label}: {label: string}) {
    return (    
        <div className={s.perspectiveText}>
            <p>{label}</p>
            <p>{label}</p>
        </div>
    )
}