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

  // Texty kontaktního okna — totéž okno jako na zbytku webu (`global.kontaktni-okno`).
  const dialogCopy = (await getPageCopy("global"))["global.kontaktni-okno"]

  return (
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
          {children}
        </main>
        <div className={styles.footer}>
          <Footer merchant={merchant} downloads={footerDownloads} />
        </div>
      </div>
    </ContactDialogProvider>
  )
}
