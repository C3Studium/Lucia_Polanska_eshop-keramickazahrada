import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getProductionPaymentMode } from "@lib/data/made-to-order"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CmsText from "@modules/common/components/cms-text"
import { CopyProvider } from "@modules/common/components/cms-text/copy-context"
import { getPageCopy } from "@lib/data/site-copy"
import { itemFieldPath, itemText } from "@lib/util/site-copy"
import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import {
  cartNeedsVoucherSetup,
  GIFT_VOUCHER_SETUP_ID,
} from "@lib/util/gift-voucher-setup"
import styles from "./page.module.scss"
import { productLines } from "@lib/util/packaging"

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

  /*
   * Nenastavený dárkový poukaz patří zpátky do košíku (30. 10. 2026). Hodnotu
   * a podobu volí zákazník tam, pod souhrnem; pokladna na to pole nemá a
   * backend by takový košík stejně nedokončil. Košík cestu sem zamyká, tohle
   * je pro přímý odkaz a pro zapamatovanou adresu.
   */
  if (cartNeedsVoucherSetup(cart as never)) {
    redirect(`/${countryCode}/cart#${GIFT_VOUCHER_SETUP_ID}`)
  }

  const customer = await retrieveCustomer()
  // Jednou tady a předané oběma stranám (formulář i souhrn) — fetch je
  // `no-store`, takže dvojí volání by znamenalo dvě cesty na backend.
  const productionMode = await getProductionPaymentMode(cart.id)
  // Kusy zboží — balné a doběrečné do počtu nepatří.
  const itemCount = productLines(cart.items).reduce((total, item) => total + item.quantity, 0)

  /*
   * Úvodní věty pokladny z CMS (stránka `pokladna`). Jen hlavička, nadpis
   * souhrnu a první věty kroků — nic z toho, co se k objednávce váže
   * (souhlasy, předsmluvní informace, platba, ceny), viz valecms.config.ts.
   * Výpadek CMS = věty z kódu.
   */
  const copy = await getPageCopy("pokladna")
  const intro = copy["pokladna.uvod"]
  const introDoc = intro?.id ?? null
  const introLead = intro?.title?.trim() || "Ještě"
  const backLabel = itemText(intro, "zpet", "Zpět do košíku")

  return (
    <div className={styles.root}>
      <header className={styles.masthead}>
        <div>
          {/* Počet výrobků je údaj, ne text — „Pokladna · 02 výrobky" zůstává v kódu. */}
          <p className={styles.mastheadMeta}>Pokladna · {String(itemCount).padStart(2, "0")} {itemCount === 1 ? "výrobek" : itemCount < 5 ? "výrobky" : "výrobků"}</p>
          {/* Začátek nadpisu ve spanu jen v náhledu Studia; jinak DOM jako dřív. */}
          <h1>
            {introDoc ? (
              <CmsText doc={introDoc} field="title">{introLead}</CmsText>
            ) : (
              introLead
            )}
            <br />
            <CmsText as="em" doc={introDoc} field="headline">
              {intro?.headline?.trim() || "pár kroků."}
            </CmsText>
          </h1>
        </div>
        <div className={styles.mastheadAside}>
          <CmsText as="p" className={styles.mastheadCopy} doc={introDoc} field="body">
            {intro?.bodyText?.trim() || "Ještě pár kroků a můžeme to z ateliéru poslat k vám."}
          </CmsText>
          <LocalizedClientLink href="/cart" className={styles.backLink}>
            <span>←</span>{" "}
            {introDoc ? (
              <CmsText doc={introDoc} field={itemFieldPath(intro, "zpet")}>{backLabel}</CmsText>
            ) : (
              backLabel
            )}
          </LocalizedClientLink>
        </div>
      </header>
      {/* Kroky jsou hluboko (formulář → krok → adresa), proto blok kontextem, ne propem. */}
      <CopyProvider blocks={{ "pokladna.kroky": copy["pokladna.kroky"] }}>
        <section className={styles.ledger}>
          <PaymentWrapper cart={cart}>
            <CheckoutForm
              cart={cart}
              customer={customer}
              countryCode={countryCode}
              productionMode={productionMode}
            />
          </PaymentWrapper>
        </section>
      </CopyProvider>
      <aside className={styles.order}>
        <CheckoutSummary
          cart={cart}
          productionMode={productionMode}
          copy={copy["pokladna.souhrn"]}
        />
      </aside>
    </div>
  )
}
