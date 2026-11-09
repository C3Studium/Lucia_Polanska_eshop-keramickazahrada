import { retrieveCart } from "@lib/data/cart"
import { getCustomerWishlistItems, retrieveCustomer } from "@lib/data/customer"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import Footer from "@modules/layout/Footer"
import { getFooterDownloads } from "@modules/layout/Footer/data"
import Navbar from "@modules/layout/Navbar"
import { listNavigationCollections } from "@lib/data/navigation"
import { getMerchantIdentity } from "@lib/data/merchant"
import { ContactDialogProvider } from "@modules/layout/ContactDialog"
import { getPageCopy } from "@lib/data/site-copy"
import { ContactEmailsProvider } from "@lib/context/contact-emails"
import { TextyProvider } from "@lib/context/texty"
import { getTexty } from "@lib/data/texty"
import { CONTACT_EMAILS_BLOCK, contactEmailsFrom } from "@lib/constants/contact"
import EditModeRemount from "@modules/common/components/cms-text/edit-remount"
import GlobalLiquidEther from "@modules/layout/components/global-liquid-ether"
import Scrollbar from "@modules/layout/scrollbar"
import styles from "./styles/layout.module.scss"

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [cart, customer, regions, wishlistItems, navigationCollections] =
    await Promise.all([
      retrieveCart(),
      retrieveCustomer(),
      listRegions().then((items: StoreRegion[]) => items),
      getCustomerWishlistItems(),
      listNavigationCollections(),
    ])

  const [merchant, footerDownloads] = await Promise.all([
    getMerchantIdentity(),
    getFooterDownloads(),
  ])

  // Texty kontaktního okna — totéž okno jako na zbytku webu (`global.kontaktni-okno`)
  // — a kontaktní e-maily ze Studia (hlášky platby, patička).
  const globalCopy = await getPageCopy("global")
  const dialogCopy = globalCopy["global.kontaktni-okno"]
  const contactEmails = contactEmailsFrom(globalCopy[CONTACT_EMAILS_BLOCK])
  // Texty obchodu z administrace (Právní věci a texty → Texty obchodu)
  // pro klientské komponenty — věty u výrobku, v košíku a v pokladně.
  const texty = await getTexty()

  return (
    <ContactEmailsProvider emails={contactEmails}>
    <TextyProvider texty={texty}>
    <ContactDialogProvider merchant={merchant} copy={dialogCopy}>
      <div className={styles.root}>
        <GlobalLiquidEther />
        <Navbar
          cart={cart}
          regions={regions}
          isLoggedIn={!!customer}
          wishlistItems={wishlistItems}
          navigationCollections={navigationCollections}
        />
        <Scrollbar />
        <main className={styles.checkoutContainer} data-testid="checkout-container">
          {/* Anotace pro Studio u stránky s `loading.tsx` — viz komponentu. */}
          <EditModeRemount>{children}</EditModeRemount>
        </main>
        <div className={styles.footer}>
          <Footer merchant={merchant} downloads={footerDownloads} />
        </div>
      </div>
    </ContactDialogProvider>
    </TextyProvider>
    </ContactEmailsProvider>
  )
}
