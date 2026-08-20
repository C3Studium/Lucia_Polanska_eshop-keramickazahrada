"use client"

import { applySavedAddressToCart, setAddresses } from "@lib/data/cart"
import compareAddresses from "@lib/util/compare-addresses"
import { CheckCircleSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Heading, Text, useToggleState } from "@medusajs/ui"

import Divider from "@modules/common/components/divider"
import Spinner from "@modules/common/icons/spinner"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState, useEffect, useMemo, useState } from "react"
import BillingAddress from "../billing_address"
import ErrorMessage from "../error-message"
import ShippingAddress from "../shipping-address"
import s from "./style.module.scss"

const Addresses = ({
  cart,
  customer,
  countryCode,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  countryCode: string
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
    // Every other step keeps the page where it is; this one threw the customer to the top.
    router.push(pathname + "?step=address", { scroll: false })
  }

  const [message, formAction] = useActionState(setAddresses, null)

  /* Logged-in with a saved address: the form does not open at all. The saved
     address is written to the cart by an action (a mutation is not a render's
     job), and meanwhile the customer already sees the collapsed summary card
     they will keep — „Doručit na: …" — instead of a form asking what the
     account knows. Fails → the ordinary form appears; nothing is ever lost. */
  const savedAddress = useMemo(() => {
    if (!customer) return null
    const regionCountries = cart?.region?.countries?.map(
      (country) => country.iso_2
    )
    const usable = (customer.addresses ?? []).filter(
      (address) =>
        address.country_code && regionCountries?.includes(address.country_code)
    )
    return (
      usable.find((address) => address.is_default_shipping) ?? usable[0] ?? null
    )
  }, [customer, cart?.region])

  const [prefill, setPrefill] = useState<"idle" | "applying" | "failed">("idle")
  const shouldPrefill =
    isOpen && !cart?.shipping_address && !!savedAddress && prefill !== "failed"

  useEffect(() => {
    if (!shouldPrefill || prefill !== "idle") return
    setPrefill("applying")
    applySavedAddressToCart()
      .then((result) => {
        if (result.success) {
          // Address answered — carry straight on to delivery, silently.
          router.replace(pathname + "?step=delivery", { scroll: false })
        } else {
          setPrefill("failed")
        }
      })
      .catch(() => setPrefill("failed"))
  }, [shouldPrefill, prefill, pathname, router])

  return (
    <div className={s.root}>
      <div className={s.headerRow}>
        <Heading level="h2" className={s.heading}>
          Doručovací a fakturační adresa
          {!isOpen && cart?.shipping_address && <CheckCircleSolid />}
        </Heading>
        {!isOpen && cart?.shipping_address && (
          <PremiumActionButton
            compact
            type="button"
            onClickAction={handleEdit}
            className={s.editBtn}
            data-testid="edit-address-button"
            text={"Upravit"}
          />
        )}
      </div>
      {isOpen && shouldPrefill && savedAddress ? (
        <div className={s.summary} aria-busy="true">
          <div className={s.row}>
            <div
              className={s.col + " shipping"}
              data-testid="shipping-address-summary"
            >
              <Text className={s.label}>Doručit na</Text>
              <Text className={s.value}>
                {savedAddress.first_name} {savedAddress.last_name}
              </Text>
              <Text className={s.value}>
                {savedAddress.address_1} {savedAddress.address_2}
              </Text>
              <Text className={s.value}>
                {savedAddress.postal_code}, {savedAddress.city}
              </Text>
              <Text className={s.value}>
                {savedAddress.country_code?.toUpperCase()}
              </Text>
            </div>
            <div className={s.col + " contact"}>
              <Text className={s.label}>Kontakt na vás</Text>
              <Text className={s.value}>
                {savedAddress.phone || customer?.phone || ""}
              </Text>
              <Text className={s.value}>{cart?.email || customer?.email}</Text>
            </div>
            <div className={s.col + " billing"}>
              <Text className={s.label}>Fakturační údaje</Text>
              <Text className={s.note}>
                Použijeme stejnou adresu jako pro doručení.
              </Text>
            </div>
          </div>
          <Text className={s.note} role="status">
            Používáme vaši uloženou adresu — změnit ji můžete tlačítkem
            Upravit.
          </Text>
        </div>
      ) : isOpen ? (
        <form action={formAction} className={s.form}>
          <div className={s.shippingAddress}>
            <ShippingAddress
              customer={customer}
              checked={sameAsBilling}
              onChange={toggleSameAsBilling}
              cart={cart}
              countryCode={countryCode}
            />

            {!sameAsBilling && (
              <div className={s.billingAddress}>
                <h2 className={s.heading}>Fakturační adresa</h2>

                <BillingAddress cart={cart} countryCode={countryCode} />
              </div>
            )}
            <PremiumActionButton
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
                <div
                  className={s.col + " shipping"}
                  data-testid="shipping-address-summary"
                >
                  <Text className={s.label}>Kam to pošleme</Text>
                  <Text className={s.value}>
                    {cart.shipping_address.first_name}{" "}
                    {cart.shipping_address.last_name}
                  </Text>
                  <Text className={s.value}>
                    {cart.shipping_address.address_1}{" "}
                    {cart.shipping_address.address_2}
                  </Text>
                  <Text className={s.value}>
                    {cart.shipping_address.postal_code},{" "}
                    {cart.shipping_address.city}
                  </Text>
                  <Text className={s.value}>
                    {cart.shipping_address.country_code?.toUpperCase()}
                  </Text>
                </div>

                <div
                  className={s.col + " contact"}
                  data-testid="shipping-contact-summary"
                >
                  <Text className={s.label}>Kontakt na vás</Text>
                  <Text className={s.value}>{cart.shipping_address.phone}</Text>
                  <Text className={s.value}>{cart.email}</Text>
                </div>

                <div
                  className={s.col + " billing"}
                  data-testid="billing-address-summary"
                >
                  <Text className={s.label}>Fakturační údaje</Text>

                  {sameAsBilling ? (
                    <Text className={s.note}>
                      Použijeme stejnou adresu jako pro doručení.
                    </Text>
                  ) : (
                    <>
                      <Text className={s.value}>
                        {cart.billing_address?.first_name}{" "}
                        {cart.billing_address?.last_name}
                      </Text>
                      <Text className={s.value}>
                        {cart.billing_address?.address_1}{" "}
                        {cart.billing_address?.address_2}
                      </Text>
                      <Text className={s.value}>
                        {cart.billing_address?.postal_code},{" "}
                        {cart.billing_address?.city}
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
