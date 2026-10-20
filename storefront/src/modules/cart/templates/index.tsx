import CheckoutBar from "./checkout-bar"
import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import Divider from "@modules/common/components/divider"
import CmsText from "@modules/common/components/cms-text"
import { HttpTypes } from "@medusajs/types"
import { itemFieldPath, itemValue } from "@lib/util/site-copy"
import type { CopyBlocks } from "@lib/util/site-copy"

import s from "./index.module.scss"
import { productLines } from "@lib/util/packaging"
import { listCartShippingMethods } from "@lib/data/fulfillment"
import { shippingFromOptions } from "../shipping-from"

/* Zakázkový blok (volba zálohy „Kolik chcete zaplatit hned?" i brief s fotkami)
   do KOŠÍKU NEPATŘÍ — majitelčino přání. Sbírá se až v pokladně (Přehled) a v
   express v kroku doručení. Košík zůstává jen o položkách a souhrnu. */

const CartTemplate = async ({
  cart,
  customer,
  copy,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  /** Bloky stránky `kosik` — `kosik.uvod`, `kosik.prazdny`, `kosik.prihlaseni`, `kosik.vypis`. */
  copy?: CopyBlocks
}) => {
  // Kusy zboží — balné a doběrečné do počtu nepatří.
  const itemCount = productLines(cart?.items).reduce((total, item) => total + item.quantity, 0)

  /*
   * Úvod košíku z bloku `kosik.uvod`: nadpis (`title`), věta pod ním (`body`)
   * a dvě položky klíčované popiskem — obočí před počtem kusů (`oboci`)
   * a poznámka nad souhrnem (`souhrn`). Položky, ne pozice v `accent`: CMS
   * z `accent` prázdné položky vyhazuje a druhá by se posunula na místo první.
   * Počet kusů a jeho skloňování drží kód — je to údaj, ne text.
   */
  const intro = copy?.["kosik.uvod"]
  const introTitle = intro?.title?.trim() || "Košík"
  const introEyebrow = itemValue(intro, "oboci")?.trim() || "Váš výběr"
  const introCopy =
    intro?.bodyText?.trim() ||
    "Všechno je dělané rukama. Než to pošleme, pečlivě to v ateliéru zabalíme."
  const secureNote = itemValue(intro, "souhrn")?.trim() || "Bezpečná platba · pečlivé balení"
  const introId = intro?.id ?? null

  /* „Doprava od …", dokud není zvolená — z možností dopravy pro TENHLE košík
     (jeho měna, jeho omezení křehké/zakázka). Dotaz je v cache „fulfillment"
     a selhání znamená jen odkaz na ceník místo částky. */
  const shippingFrom =
    cart?.items?.length && !(cart.shipping_methods?.length ?? 0)
      ? shippingFromOptions(
          await listCartShippingMethods(cart.id).catch(() => null),
          cart
        )
      : null

  return (
    <>
    <div className={s.root}>
      <div className={s.container} data-testid="cart-container">
        {cart?.items?.length ? (
          <>
            <header className={s.intro}>
              {/* Obočí bez počtu kusů ve vlastním spanu — počet je údaj, ne text. */}
              <p className={s.eyebrow}><CmsText doc={introId} field={itemFieldPath(intro, "oboci")}>{introEyebrow}</CmsText> · {itemCount} {itemCount === 1 ? "kus" : itemCount < 5 ? "kusy" : "kusů"}</p>
              <CmsText as="h1" doc={introId} field="title">{introTitle}</CmsText>
              <div className={s.objectMark} aria-hidden="true">
                <span />
                <i />
                <b />
              </div>
              <CmsText as="p" className={s.introCopy} doc={introId} field="body">{introCopy}</CmsText>
            </header>
            <div className={s.grid}>
              <div className={s.left}>
              {!customer && (
                <>
                  <SignInPrompt block={copy?.["kosik.prihlaseni"]} />
                  <Divider />
                </>
              )}
              <ItemsTemplate cart={cart} copy={copy?.["kosik.vypis"]} />
              </div>
              <div className={s.right}>
                <div className={s.sticky}>
                  {cart && cart.region && (
                    <div className={s.summaryBox}>
                      <CmsText as="p" className={s.secureNote} doc={introId} field={itemFieldPath(intro, "souhrn")}>{secureNote}</CmsText>
                      <Summary
                        cart={cart as any}
                        shippingFrom={shippingFrom}
                        copy={copy?.["kosik.vypis"]}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={s.emptyWrap}>
            <EmptyCartMessage block={copy?.["kosik.prazdny"]} />
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
    {cart?.items?.length ? (
      <CheckoutBar cart={cart as any} shippingFrom={shippingFrom} />
    ) : null}
    </>
  )
}

export default CartTemplate
