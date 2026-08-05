"use client"

import { Listbox } from "@headlessui/react"
import { ChevronUpDown } from "@medusajs/icons"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import { useMemo } from "react"

import compareAddresses from "@lib/util/compare-addresses"
import Radio from "@modules/common/components/radio"
import { HttpTypes } from "@medusajs/types"
import s from "./style.module.scss"

type AddressSelectProps = {
  addresses: HttpTypes.StoreCustomerAddress[]
  addressInput: HttpTypes.StoreCartAddress | null
  onSelect: (
    address: HttpTypes.StoreCartAddress | undefined,
    email?: string
  ) => void
}

const addressOptionsVariants: Variants = {
  closed: {
    opacity: 0,
    height: 0,
    y: -8,
    transition: {
      height: { duration: 0.36, ease: [0.76, 0, 0.24, 1] },
      opacity: { duration: 0.18, ease: "easeIn" },
    },
  },
  open: {
    opacity: 1,
    height: "auto",
    y: 0,
    transition: {
      height: { duration: 0.5, ease: [0.76, 0, 0.24, 1] },
      opacity: { duration: 0.24, delay: 0.12, ease: "easeOut" },
      staggerChildren: 0.05,
      delayChildren: 0.12,
    },
  },
}

const addressOptionVariants: Variants = {
  closed: { opacity: 0, y: 8 },
  open: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

const AddressSelect = ({
  addresses,
  addressInput,
  onSelect,
}: AddressSelectProps) => {
  const handleSelect = (id: string) => {
    const savedAddress = addresses.find((address) => address.id === id)
    if (savedAddress) {
      onSelect(savedAddress as HttpTypes.StoreCartAddress)
    }
  }

  const selectedAddress = useMemo(() => {
    return addresses.find((address) =>
      compareAddresses(address, addressInput)
    )
  }, [addresses, addressInput])

  return (
    <Listbox onChange={handleSelect} value={selectedAddress?.id ?? ""}>
      {({ open }) => (
        <div className={s.accountAddressSelectRoot}>
          <Listbox.Button
            className={s.accountAddressSelectButton}
            data-testid="shipping-address-select"
          >
            <span className={s.accountAddressSelectedCopy}>
              <small>{selectedAddress ? "Vybraná adresa" : "Uložené adresy"}</small>
              <strong>
                {selectedAddress
                  ? `${selectedAddress.first_name} ${selectedAddress.last_name}`
                  : "Vyberte místo doručení"}
              </strong>
              <span>
                {selectedAddress
                  ? [
                      selectedAddress.address_1,
                      selectedAddress.postal_code,
                      selectedAddress.city,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "Otevřít váš adresář"}
              </span>
            </span>
            <motion.span
              className={s.accountAddressSelectControl}
              animate={open ? "open" : "closed"}
              variants={variants}
              transition={transition}
              aria-hidden="true"
            >
              <ChevronUpDown />
            </motion.span>
          </Listbox.Button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                className={s.accountAddressOptionsClip}
                variants={addressOptionsVariants}
                initial="closed"
                animate="open"
                exit="closed"
              >
                <Listbox.Options
                  static
                  className={s.accountAddressOptions}
                  data-testid="shipping-address-options"
                >
                  {addresses.map((address, index) => (
                    <Listbox.Option
                      key={address.id}
                      value={address.id}
                      className={s.accountAddressOption}
                      data-testid="shipping-address-option"
                    >
                      {({ active, selected }) => (
                        <motion.div
                          className={s.accountAddressOptionInner}
                          variants={addressOptionVariants}
                        >
                          <motion.span
                            className={s.accountAddressOptionHighlight}
                            initial={false}
                            animate={{ scaleX: active || selected ? 1 : 0 }}
                            transition={transition2}
                            aria-hidden="true"
                          />
                          <span className={s.accountAddressOptionIndex}>
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <Radio
                            checked={selected}
                            data-testid="shipping-address-radio"
                          />
                          <span className={s.accountAddressOptionCopy}>
                            <strong>
                              {address.first_name} {address.last_name}
                            </strong>
                            {address.company && <small>{address.company}</small>}
                            <span>
                              {address.address_1}
                              {address.address_2
                                ? `, ${address.address_2}`
                                : ""}
                            </span>
                            <span>
                              {address.postal_code} {address.city}
                              {address.country_code
                                ? ` · ${address.country_code.toUpperCase()}`
                                : ""}
                            </span>
                          </span>
                          <span
                            className={s.accountAddressOptionState}
                            aria-hidden="true"
                          >
                            {selected ? "Vybráno" : "Použít"}
                          </span>
                        </motion.div>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Listbox>
  )
}

export default AddressSelect


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const variants = {
                closed: { rotate: 0 },
                open: { rotate: 180 },
              }
const transition = {
                duration: 0.42,
                ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
              }
const transition2 = {
                              duration: 0.42,
                              ease: [0.76, 0, 0.24, 1] as [number, number, number, number],
                            }
