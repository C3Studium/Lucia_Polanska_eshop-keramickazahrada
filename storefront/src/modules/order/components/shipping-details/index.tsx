import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import styles from "../styles/shipping-details.module.scss"

import Divider from "@modules/common/components/divider"

type ShippingDetailsProps = {
  order: HttpTypes.StoreOrder
}

const ShippingDetails = ({ order }: ShippingDetailsProps) => {
  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Kam objednávka míří</h2>
      <div className={styles.row}>
        <div className={styles.col} data-testid="shipping-address-summary">
          <p className={styles.label}>Adresa doručení</p>
          <p className={styles.value}>
            {order.shipping_address?.first_name} {order.shipping_address?.last_name}
          </p>
          <p className={styles.value}>
            {order.shipping_address?.address_1} {order.shipping_address?.address_2}
          </p>
          <p className={styles.value}>
            {order.shipping_address?.postal_code}, {order.shipping_address?.city}
          </p>
          <p className={styles.value}>
            {order.shipping_address?.country_code?.toUpperCase()}
          </p>
        </div>

        <div className={styles.col} data-testid="shipping-contact-summary">
          <p className={styles.label}>Kontakt</p>
          <p className={styles.value}>{order.shipping_address?.phone}</p>
          <p className={styles.value}>{order.email}</p>
        </div>

        <div className={styles.col} data-testid="shipping-method-summary">
          <p className={styles.label}>Doprava</p>
          <p className={styles.value}>
            {(order as any).shipping_methods[0]?.name}
          </p>
          <p className={styles.secondaryValue}>
            Cena dopravy ·{" "}
            {convertToLocale({
              amount: order.shipping_methods?.[0].total ?? 0,
              currency_code: order.currency_code,
            })
              .replace(/,/g, "")
              .replace(/\./g, ",")}
          </p>
        </div>
      </div>
      <Divider className={styles.divider} />
    </div>
  )
}

export default ShippingDetails
