import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import styles from "../styles/order-summary.module.scss"

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

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Souhrn objednávky</h2>
      <div className={styles.content}>
        <div className={styles.row}>
          <span>Mezisoučet</span>
          <span>{getAmount(order.subtotal)}</span>
        </div>
        <div className={styles.meta}>
          {order.discount_total > 0 && (
            <div className={styles.row}>
              <span>Sleva</span>
              <span>- {getAmount(order.discount_total)}</span>
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
          <div className={styles.row}>
            <span>Daně</span>
            <span>{getAmount(order.tax_total)}</span>
          </div>
        </div>
        <div className={styles.separator} />
        <div className={styles.row}>
          <span>Celkem</span>
          <span>{getAmount(order.total)}</span>
        </div>
      </div>
    </div>
  )
}

export default OrderSummary
