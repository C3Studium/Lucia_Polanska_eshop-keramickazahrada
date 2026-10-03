import CheckoutBar from "./checkout-bar"
import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import Divider from "@modules/common/components/divider"
import { HttpTypes } from "@medusajs/types"

import s from "./index.module.scss"

/* Zakázkový blok (volba zálohy „Kolik chcete zaplatit hned?" i brief s fotkami)
   do KOŠÍKU NEPATŘÍ — majitelčino přání. Sbírá se až v pokladně (Přehled) a v
   express v kroku doručení. Košík zůstává jen o položkách a souhrnu. */

const CartTemplate = async ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const itemCount = cart?.items?.reduce((total, item) => total + item.quantity, 0) ?? 0

  return (
    <>
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

    {/*
      * Částka a cesta k pokladně na dosah — jen na svislých telefonech, kde se
      * souhrn složí až pod výpis.
      *
      * MIMO `.root`: ten má `overflow: clip`, a ten na rozdíl od `hidden`
      * ořezává i potomky s `position: fixed`. Uvnitř byl pruh vidět jen nahoře
      * a při odrolování dolů zmizel — tedy přesně tam, kde ho je potřeba
      * nejvíc.
      */}
    {cart?.items?.length ? <CheckoutBar cart={cart as any} /> : null}
    </>
  )
}

export default CartTemplate
