import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import styles from "./page.module.scss"

export const metadata: Metadata = {
  title: "Pokladna",
  description: "Dokončení objednávky — doprava, platba a přehled.",
}

export default async function Checkout(props:{params: Promise<{countryCode:string}>}) {
  const cart = await retrieveCart()
  const params = await props.params
  const { countryCode } = params
  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()
  const itemCount = cart.items?.reduce((total, item) => total + item.quantity, 0) ?? 0

  return (
    <div className={styles.root}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.mastheadMeta}>Pokladna · {String(itemCount).padStart(2, "0")} {itemCount === 1 ? "výrobek" : "výrobky"}</p>
          <h1>Ještě<br /><em>pár kroků.</em></h1>
        </div>
        <div className={styles.mastheadAside}>
          <p className={styles.mastheadCopy}>
            Ještě pár kroků a můžeme to z ateliéru poslat k vám.
          </p>
          <LocalizedClientLink href="/cart" className={styles.backLink}>
            <span>←</span> Zpět do košíku
          </LocalizedClientLink>
        </div>
      </header>
      <section className={styles.ledger}>
        <PaymentWrapper cart={cart}>
          <CheckoutForm cart={cart} customer={customer} countryCode={countryCode} />
        </PaymentWrapper>
      </section>
      <aside className={styles.order}>
        <CheckoutSummary cart={cart} />
      </aside>
    </div>
  )
}
