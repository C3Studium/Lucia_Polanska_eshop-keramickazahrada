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

export default async function Checkout(props:{
  params: Promise<{countryCode:string}>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const cart = await retrieveCart()
  const params = await props.params
  /* Přehled bez levého souhrnu (16. 11. 2026, Matěj): krok Přehled sám
     ukazuje položky i ceny, takže souhrn vlevo by tytéž údaje opakoval
     podruhé. Slevový kód se přestěhoval do Přehledu. */
  const isReview = (await props.searchParams)?.step === "review"
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
  // Fotky výrobků pro tichou koláž vedle Přehledu — každý výrobek jednou, nejvýš šest.
  const artImages = isReview
    ? (Array.from(new Set(productLines(cart.items).map((item: any) => item.thumbnail).filter(Boolean))) as string[]).slice(0, 6)
    : []

  /*
   * Úvodní věty pokladny z CMS (stránka `pokladna`). Jen hlavička, nadpis
   * souhrnu a první věty kroků — nic z toho, co se k objednávce váže
   * (souhlasy, předsmluvní informace, platba, ceny), viz valecms.config.ts.
   * Výpadek CMS = věty z kódu.
   */
  const copy = await getPageCopy("pokladna")
  const intro = copy["pokladna.uvod"]
  const introDoc = intro?.id ?? null
  const backLabel = itemText(intro, "zpet", "Zpět do košíku")

  return (
    <div className={styles.root} data-step={isReview ? "review" : undefined}>
      {/* Hlavička přes oba sloupce (15. 11. 2026, Matěj): kde jsem a cesta
          zpět nahoře, takže „Přehled objednávky" vlevo a kroky pokladny
          vpravo začínají na stejné výšce. */}
      <header className={styles.masthead}>
        {/* Počet výrobků je údaj, ne text — „Pokladna · 02 výrobky" zůstává v kódu. */}
        <p className={styles.mastheadMeta}>Pokladna · {String(itemCount).padStart(2, "0")} {itemCount === 1 ? "výrobek" : itemCount < 5 ? "výrobky" : "výrobků"}</p>
        <LocalizedClientLink href="/cart" className={styles.backLink}>
          <span>←</span>{" "}
          {introDoc ? (
            <CmsText doc={introDoc} field={itemFieldPath(intro, "zpet")}>{backLabel}</CmsText>
          ) : (
            backLabel
          )}
        </LocalizedClientLink>
      </header>
      {/* Vlevo souhrn objednávky, vpravo formulář kroku. */}
      {/* Přehled (16. 11. 2026, Matěj): panel zůstává vpravo jako v ostatních
          krocích, aby oko neskákalo. Místo souhrnu (údaje by se opakovaly)
          je vlevo jen tichá koláž fotek objednaných výrobků — ozdoba, nic
          se na ní neklikne a čtečka ji přeskočí. */}
      {isReview && (
        <div className={styles.reviewArt} aria-hidden="true" data-count={Math.min(artImages.length, 6)}>
          {artImages.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" loading="lazy" decoding="async" />
          ))}
        </div>
      )}
      {!isReview && (
        <div className={styles.intro}>
          <aside className={styles.order}>
            <CheckoutSummary
              cart={cart}
              productionMode={productionMode}
              copy={copy["pokladna.souhrn"]}
            />
          </aside>
        </div>
      )}
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
    </div>
  )
}
