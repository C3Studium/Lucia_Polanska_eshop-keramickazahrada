"use client"

import { useState, type ReactNode } from "react"
import { HttpTypes } from "@medusajs/types"
import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import Thumbnail from "@modules/products/components/thumbnail"
import { convertToLocale } from "@lib/util/money"
import { vyrobek } from "@lib/util/plurals"
import styles from "./style.module.scss"

/**
 * Celý souhrn objednávky pod jedno klepnutí — na svislé obrazovce.
 *
 * ## Co se schovává
 *
 * Všechno kromě toho, co člověk potřebuje vidět pořád: výpis kusů, mezisoučet,
 * sleva, doprava i pole na slevový kód. Zavřený souhrn říká jen tři věci —
 * **co** (náhledy a počet), **kolik** (celkem) a **jestli je uplatněná sleva**
 * (kód). To jsou přesně ty tři otázky, kvůli kterým se člověk u pokladny na
 * souhrn dívá; podrobnosti si otevře, když chce.
 *
 * Nesloží se to takhle jen kvůli místu. Souhrn stojí NAD formulářem
 * (`page.module.scss`), aby se rozbaloval nad ním a člověk se po zavření
 * vracel tam, kde přestal vyplňovat. Rozbalený souhrn dole by po zavření
 * uskočil a formulář by se posunul pod prstem.
 *
 * ## Proč to není `<details>`
 *
 * Nabízelo by se — přístupné a bez skriptu. Jenže na širokém okně má být obsah
 * **vždycky** vidět a spoušť vůbec, a obsah zavřeného `<details>` prohlížeč
 * skrývá po svém (přeskočený obsah, ne `display`), takže se to zvenčí
 * spolehlivě odemknout nedá.
 *
 * Takhle je stav jen atribut a o tom, jestli na něm vůbec záleží, rozhoduje
 * CSS: nad svislým tabletem se spoušť schová a obsah se ukazuje bez ohledu na
 * to, co si stav myslí. Žádný dotaz na šířku okna ve skriptu, tedy ani
 * nesoulad při hydrataci.
 */

/** Kolik náhledů se vejde vedle sebe, než začne „+N". */
const NAHLEDU = 3

type Props = {
  cart: HttpTypes.StoreCart & { promotions?: HttpTypes.StorePromotion[] }
  /** Součty a slevový kód — všechno, co ve výpisu následuje za kusy. */
  children: ReactNode
}

const OrderSummaryDisclosure = ({ cart, children }: Props) => {
  const [otevreno, setOtevreno] = useState(false)

  /*
   * Řadí se stejně jako ve výpisu (`templates/preview.tsx`), a na kopii:
   * `sort` mění pole na místě a to tady patří komponentě nad námi.
   */
  const polozky = [...(cart.items ?? [])].sort((a, b) =>
    (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
  )

  const nahledy = polozky.slice(0, NAHLEDU)
  const zbyva = polozky.length - nahledy.length

  /* Počet se čte z kusů, ne z řádků: dva stejné hrnky jsou jeden řádek a dva
     výrobky, a zaplatí se za dva. */
  const kusu = polozky.reduce((soucet, item) => soucet + item.quantity, 0)

  /* Automatické akce se nevypisují — zákazník je nezadával a v zavřeném
     souhrnu jde o to, jestli JEHO kód platí. */
  const kod = (cart.promotions ?? []).find(
    (promotion) => !promotion.is_automatic && promotion.code
  )?.code

  return (
    <div className={styles.root} data-otevreno={otevreno ? "ano" : "ne"}>
      <button
        type="button"
        className={styles.spoust}
        onClick={() => setOtevreno((stav) => !stav)}
        aria-expanded={otevreno}
        aria-controls="souhrn-objednavky"
        data-testid="order-summary-toggle"
      >
        <span className={styles.hlavni}>
          <span className={styles.nahledy}>
            {nahledy.map((item) => (
              <span className={styles.nahled} key={item.id}>
                <Thumbnail
                  thumbnail={item.thumbnail}
                  images={item.variant?.product?.images}
                  size="square"
                />
              </span>
            ))}
            {zbyva > 0 && (
              <span className={styles.zbytek} aria-hidden="true">
                +{zbyva}
              </span>
            )}
          </span>

          <span className={styles.pocet}>
            {kusu} {vyrobek(kusu)}
          </span>

          <span className={styles.sipka} aria-hidden="true" />
        </span>

        <span className={styles.celkem}>
          <span className={styles.celkemPopis}>Celkem</span>
          <span className={styles.celkemCastka}>
            {convertToLocale({
              amount: cart.total ?? 0,
              currency_code: cart.currency_code,
            })}
          </span>
        </span>

        {kod && (
          <span className={styles.kod}>
            <span className={styles.kodZnacka}>{kod}</span>
            <span className={styles.kodPopis}>uplatněný slevový kód</span>
          </span>
        )}
      </button>

      <div className={styles.obsah} id="souhrn-objednavky">
        <ItemsPreviewTemplate cart={cart} />
        {children}
      </div>
    </div>
  )
}

export default OrderSummaryDisclosure
