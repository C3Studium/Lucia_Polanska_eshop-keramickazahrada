import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getPageCopy } from "@lib/data/site-copy"
import CartTemplate from "@modules/cart/templates"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Košík",
  description: "Co máte v košíku.",
}

export default async function Cart() {
  const cart = await retrieveCart().catch((error) => {
    console.error(error)
    return notFound()
  })

  const customer = await retrieveCustomer()

  // Redakční texty košíku (úvod, prázdný košík, výzva k přihlášení).
  // Výpadek CMS = texty z kódu.
  const copy = await getPageCopy("kosik")

  return <CartTemplate cart={cart} customer={customer} copy={copy} />
}
