import { convertToLocale } from "@lib/util/money"
import { PLATCE_DPH } from "@lib/util/dph"
import { HttpTypes } from "@medusajs/types"
import styles from "../styles/order-summary.module.scss"
import { dobirkaFeeSubtotal, packagingSubtotal } from "@lib/util/packaging"
import {
  hasPriceOnRequestLine,
  PRICE_ON_REQUEST_ORDER_NOTE,
} from "@lib/util/price-on-request"

type OrderSummaryProps = {
  order: HttpTypes.StoreOrder
}

const OrderSummary = ({ order }: OrderSummaryProps) => {
  const getAmount = (amount?: number | null) => {
    if (amount === null || amount === undefined) {
      return
    }

    return convertToLocale({
      amount,
      currency_code: order.currency_code,
    })
  }

  const packaging = packagingSubtotal(order.items)
  const dobirkaFee = dobirkaFeeSubtotal(order.items)

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Kolik to dělá</h2>
      <div className={styles.content}>
        <div className={styles.row}>
          <span>Mezisoučet</span>
          {/* Před slevou, ne po ní. `item_total` je součet položek už PO
              odečtení akcí, takže se sleva o řádek níž započítala podruhé
              a sloupec nevycházel. */}
          <span>{getAmount(order.item_subtotal)}</span>
        </div>
        {/* Rozpad mezisoučtu: výrobky, balné a doběrečné, odsazeně.
            Doběrečné do „Výrobky" nepatří — vlastní řádek. */}
        {(packaging !== null || dobirkaFee !== null) && (
          <>
            <div className={styles.row} style={{ paddingLeft: ".9rem", opacity: 0.78, fontSize: ".9em" }}>
              <span>Výrobky</span>
              <span>{getAmount(order.item_subtotal - (packaging ?? 0) - (dobirkaFee ?? 0))}</span>
            </div>
            {packaging !== null && (
              <div className={styles.row} style={{ paddingLeft: ".9rem", opacity: 0.78, fontSize: ".9em" }}>
                <span>Balné</span>
                <span>{getAmount(packaging)}</span>
              </div>
            )}
            {dobirkaFee !== null && (
              <div className={styles.row} style={{ paddingLeft: ".9rem", opacity: 0.78, fontSize: ".9em" }}>
                <span>Doběrečné</span>
                <span>{getAmount(dobirkaFee)}</span>
              </div>
            )}
          </>
        )}
        <div className={styles.meta}>
          {order.item_discount_total > 0 && (
            <div className={styles.row}>
              <span>Sleva</span>
              {/* Sleva na ZBOŽÍ: `discount_total` nese i tu dopravní, a ta je
                  už odečtená v řádku Doprava níž. */}
              <span>- {getAmount(order.item_discount_total)}</span>
            </div>
          )}
          {order.gift_card_total > 0 && (
            <div className={styles.row}>
              <span>Darovací poukaz</span>
              <span>- {getAmount(order.gift_card_total)}</span>
            </div>
          )}
          <div className={styles.row}>
            <span>Doprava</span>
            <span>{getAmount(order.shipping_total)}</span>
          </div>
          {/* Jen pro plátce DPH — viz `lib/util/dph.ts`. */}
          {PLATCE_DPH && (
            <div className={styles.row}>
              <span>Daně</span>
              <span>{getAmount(order.tax_total)}</span>
            </div>
          )}
        </div>
        <div className={styles.separator} />
        <div className={styles.row}>
          <span>Celkem</span>
          <span>{getAmount(order.total)}</span>
        </div>
        {/* Cena po domluvě: řádek stojí 0 Kč, cena přijde e-mailem. */}
        {hasPriceOnRequestLine(order.items as any) && (
          <p
            style={{ opacity: 0.78, fontSize: ".9em", marginTop: ".6rem" }}
            data-testid="order-price-on-request-note"
          >
            {PRICE_ON_REQUEST_ORDER_NOTE}
          </p>
        )}
      </div>
    </div>
  )
}

export default OrderSummary
