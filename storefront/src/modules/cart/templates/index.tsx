import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import Divider from "@modules/common/components/divider"
import { HttpTypes } from "@medusajs/types"

import s from "./index.module.scss"

const CartTemplate = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const itemCount = cart?.items?.reduce((total, item) => total + item.quantity, 0) ?? 0

  return (
    <div className={s.root}>
      <div className={s.container} data-testid="cart-container">
        {cart?.items?.length ? (
          <>
            <header className={s.intro}>
              <p className={s.eyebrow}>Váš výběr · {itemCount} {itemCount === 1 ? "kus" : "kusy"}</p>
              <h1>Košík</h1>
              <div className={s.objectMark} aria-hidden="true">
                <span />
                <i />
                <b />
              </div>
              <p className={s.introCopy}>Každý kus vzniká rukama. Před odesláním jej bezpečně zabalíme v píseckém ateliéru.</p>
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
