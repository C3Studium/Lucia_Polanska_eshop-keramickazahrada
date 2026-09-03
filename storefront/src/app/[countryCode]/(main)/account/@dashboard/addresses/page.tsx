import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"


import { getRegion } from "@lib/data/regions"
import { retrieveCustomer } from "@lib/data/customer"
import styles from "../styles/addresses.module.scss"
import AddressesTemplate from "@modules/account/templates/addresses-template"

export const metadata: Metadata = {
  title: "Doručovací adresy",
  description: "Správa uložených doručovacích a fakturačních adres.",
}

export default async function Addresses(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params
  const { countryCode } = params
  const customer = await retrieveCustomer()
  const region = await getRegion(countryCode)

  /*
   * Signed out is a redirect, not a 404 — telling someone their account does not exist because
   * their session expired is both wrong and a dead end. No country code needed: the middleware
   * resolves `/account` to the visitor's region and lands them on the login form.
   */
  if (!customer) {
    redirect("/account")
  }

  /* A missing region is a real failure, and stays one. */
  if (!region) {
    notFound()
  }

  // WIP: Figure out how to translate the countries names to czech and other languages

  return (
    <main className={styles.root}>
        <AddressesTemplate customer={customer} region={region} />
    </main>
  )
}
