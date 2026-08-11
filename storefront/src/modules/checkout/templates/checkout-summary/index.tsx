import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import DiscountCode from "@modules/checkout/components/discount-code"
import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import styles from "./style.module.scss"

const CheckoutSummary = ({ cart }: { cart: any }) => {
  return (
    <div className={styles.root}>
      <div className={styles.summary}>
        <p className={styles.eyebrow}>Přehled objednávky</p>
        <h2 className={styles.heading}>Co objednáváte</h2>
        <ItemsPreviewTemplate cart={cart} />
        <Divider className={styles.divider} />
        <CartTotals totals={cart} />
        <div className={styles.discount}>
          <DiscountCode cart={cart} />
        </div>
      </div>
    </div>
  )
}

export default CheckoutSummary
