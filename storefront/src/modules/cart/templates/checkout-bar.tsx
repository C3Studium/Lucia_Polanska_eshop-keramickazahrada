"use client"

import { convertToLocale } from "@lib/util/money"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { HttpTypes } from "@medusajs/types"

import { getCheckoutStep } from "./summary"
import s from "./checkout-bar.module.scss"

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
  cart: HttpTypes.StoreCart
}) {
  return (
    <div className={s.root}>
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
