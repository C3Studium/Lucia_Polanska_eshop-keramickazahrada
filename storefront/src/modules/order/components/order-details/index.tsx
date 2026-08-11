import { HttpTypes } from "@medusajs/types"
import { translateStatus } from "@lib/i18n/statuses"
import styles from "../styles/order-details.module.scss"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
}

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  const formattedDate = new Date(order.created_at).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <section className={styles.accountOrderMetaRoot}>
      <div className={styles.accountOrderConfirmation}>
        <span>Potvrzení objednávky</span>
        <p>
          Potvrzení jsme poslali na{" "}
          <strong data-testid="order-email">{order.email}</strong>
        </p>
      </div>
      <dl className={styles.accountOrderMetaGrid}>
        <div>
          <dt>Vytvořeno</dt>
          <dd data-testid="order-date">{formattedDate}</dd>
        </div>
        <div>
          <dt>Číslo objednávky</dt>
          <dd data-testid="order-id">#{order.display_id}</dd>
        </div>
        {showStatus && (
          <>
            <div>
              <dt>Stav objednávky</dt>
              <dd data-testid="order-status">
                {translateStatus(order.fulfillment_status, "fulfillment", "cs")}
              </dd>
            </div>
            <div>
              <dt>Stav platby</dt>
              <dd data-testid="order-payment-status">
                {translateStatus(order.payment_status, "payment", "cs")}
              </dd>
            </div>
          </>
        )}
      </dl>
    </section>
  )
}

export default OrderDetails
