"use client"

import React from "react"
import { motion } from "framer-motion"

import AddAddress from "../address-card/add-address"
import EditAddress from "../address-card/edit-address-modal"
import { HttpTypes } from "@medusajs/types"
import s from "./style.module.scss"
import { accountListItemVariants, accountListVariants } from "../../motion"

type AddressBookProps = {
  customer: HttpTypes.StoreCustomer
  region: HttpTypes.StoreRegion
}

const AddressBook: React.FC<AddressBookProps> = ({ customer, region }) => {
  const { addresses } = customer

  return (
    <div className={s.root}>
      <AddAddress region={region} addresses={addresses} />
      <motion.div
        className={s.grid}
        variants={accountListVariants}
        initial="hidden"
        animate="visible"
        data-testid="address-list"
      >
        {addresses.map((address) => {
          return (
            <motion.div key={address.id} variants={accountListItemVariants}>
              <EditAddress region={region} address={address} />
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}

export default AddressBook
