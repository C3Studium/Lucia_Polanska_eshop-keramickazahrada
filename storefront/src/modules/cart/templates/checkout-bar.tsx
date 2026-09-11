"use client"

import { convertToLocale } from "@lib/util/money"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { HttpTypes } from "@medusajs/types"

import { getCheckoutStep } from "./summary"
import s from "./checkout-bar.module.scss"
import { PLATCE_DPH } from "@lib/util/dph"

/**
 * Celková částka a cesta k pokladně na dosah — jen na svislých telefonech.
 *
 * Na širokém okně stojí souhrn v lepkavém sloupci vedle výpisu, takže je
 * částka i tlačítko pořád na očích. Na telefonu se ten sloupec složí pod výpis
 * a tlačítko skončilo 2101 px od začátku stránky (naměřeno se třemi kusy),
 * tedy přes dvě obrazovky scrollování dolů — a kdo mezitím měnil množství,
 * musel se pro kontrolu částky vracet.
 *
 * Pruh to řeší, aniž by se sahalo na pořadí stránky: výpis zůstává první,
 * protože v košíku se nejdřív kontroluje, co v něm je, a částka se počítá
 * z toho. Souhrn níž si nechává rozpad na dopravu, daně a slevový kód —
 * tady je jen výsledek a tlačítko.
 */
export default function CheckoutBar({
  cart,
}: {
  /* Se slevami, protože pruh nese i zadání kódu — tentýž tvar, jaký chce
     Summary; volající (index.tsx) posílá jeden a týž košík oběma. */
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
}) {
  return (
    <div className={s.root}>
      {/* Souhrn, který na svislém tabletu stojí místo panelu pod výpisem.
          Řádky jsou popisek vlevo a částka vpravo, jako v tom panelu — jen bez
          slevového kódu, ten se zadává tam a rozbaluje si vlastní pole.
          Ve stylech je celý blok vidět jen na svislém tabletu; na telefon se do
          pruhu nevejde a rozpad tam zůstává v panelu. */}
      <span className={s.breakdown}>
        <span className={s.breakdownHead}>
          <span className={s.breakdownEyebrow}>Souhrn</span>
          {/* Slevový kód sem přišel s celým souhrnem: panel pod výpisem je na
              svislém tabletu skrytý, takže jinde by se kód zadat nedal.
              Rozbalovací pole si komponenta animuje sama a pruh je ukotvený
              dolů, takže mu naroste směrem nahoru. */}
          <DiscountCode cart={cart} layout="inline" />
        </span>
        <span className={s.line}>
          <span>Mezisoučet</span>
          <span>
            {convertToLocale({
              amount: cart.subtotal ?? 0,
              currency_code: cart.currency_code,
            })}
          </span>
        </span>
        <span className={s.line}>
          <span>Doprava</span>
          <span>
            {convertToLocale({
              amount: cart.shipping_total ?? 0,
              currency_code: cart.currency_code,
            })}
          </span>
        </span>
        {/* Jen pro plátce DPH — viz `lib/util/dph.ts`. */}
        {PLATCE_DPH && (
          <span className={s.line}>
            <span>Daně</span>
            <span>
              {convertToLocale({
                amount: cart.tax_total ?? 0,
                currency_code: cart.currency_code,
              })}
            </span>
          </span>
        )}
      </span>

      <span className={s.total}>
        <small>Celkem</small>
        <strong>
          {convertToLocale({
            amount: cart.total ?? 0,
            currency_code: cart.currency_code,
          })}
        </strong>
      </span>

      <LocalizedClientLink
        href={`/checkout?step=${getCheckoutStep(cart)}`}
        className={s.cta}
        data-testid="checkout-bar-button"
      >
        K pokladně
      </LocalizedClientLink>
    </div>
  )
}
