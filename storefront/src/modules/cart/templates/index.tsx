import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import Divider from "@modules/common/components/divider"
import { HttpTypes } from "@medusajs/types"

import { getProductionPaymentMode } from "@lib/data/made-to-order"
import { readCommissionBrief } from "@lib/util/made-to-order"
import { isCommissionLine } from "@lib/util/commission"
import CartCommissionBlock, {
  type CartCommissionLine,
} from "@modules/cart/components/commission-block"

import s from "./index.module.scss"

const CartTemplate = async ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const itemCount = cart?.items?.reduce((total, item) => total + item.quantity, 0) ?? 0

  /* Asked here as well as at checkout: a commission's deposit is the thing most likely to
     surprise someone at the till, and the basket is where they are still deciding. The choice
     lives on the cart, so whatever is set here is what checkout opens on. */
  const productionMode = cart?.id
    ? await getProductionPaymentMode(cart.id)
    : null

  /* The commissioned lines, so the basket can collect their briefs — the description and
     photos moved here from the product page. Either signal counts (category or metadata
     marker), same as the checkout's detection. */
  const commissionLines: CartCommissionLine[] = ((cart?.items ?? []) as any[])
    .filter((item) => isCommissionLine(item) || item?.metadata?.made_to_order)
    .map((item) => ({
      id: item.id as string,
      title: (item.product_title || item.title) as string,
      brief: readCommissionBrief(item),
    }))

  return (
    <div className={s.root}>
      <div className={s.container} data-testid="cart-container">
        {cart?.items?.length ? (
          <>
            <header className={s.intro}>
              <p className={s.eyebrow}>Váš výběr · {itemCount} {itemCount === 1 ? "kus" : itemCount < 5 ? "kusy" : "kusů"}</p>
              <h1>Košík</h1>
              <div className={s.objectMark} aria-hidden="true">
                <span />
                <i />
                <b />
              </div>
              <p className={s.introCopy}>Všechno je dělané rukama. Než to pošleme, pečlivě to v ateliéru zabalíme.</p>
            </header>
            <div className={s.grid}>
              <div className={s.left}>
              {!customer && (
                <>
                  <SignInPrompt />
                  <Divider />
                </>
              )}
              <ItemsTemplate cart={cart} />
              {(commissionLines.length > 0 ||
                productionMode?.has_made_to_order) && (
                <CartCommissionBlock
                  cartId={cart.id}
                  lines={commissionLines}
                  productionMode={productionMode}
                />
              )}
              </div>
              <div className={s.right}>
                <div className={s.sticky}>
                  {cart && cart.region && (
                    <div className={s.summaryBox}>
                      <p className={s.secureNote}>Bezpečná platba · pečlivé balení</p>
                      <Summary cart={cart as any} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={s.emptyWrap}>
            <EmptyCartMessage />
          </div>
        )}
      </div>
    </div>
  )
}

export default CartTemplate
