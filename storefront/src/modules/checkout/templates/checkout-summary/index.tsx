import OrderSummaryDisclosure from "@modules/checkout/components/order-summary-disclosure"
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
        {/*
          Na svislé obrazovce je celý souhrn na rozbalení: zavřený ukáže
          náhledy, celkovou částku a uplatněný kód, zbytek si otevře, kdo
          chce. Jinde se chová přesně jako dřív — proč, viz
          `order-summary-disclosure`.

          Součty a slevový kód jdou dovnitř jako potomci, ne novým importem
          tam: pořadí a třídy zůstávají tady, kde jsou i jejich styly.
        */}
        <OrderSummaryDisclosure cart={cart}>
          <Divider className={styles.divider} />
          <CartTotals totals={cart} />
          <div className={styles.discount}>
            <DiscountCode cart={cart} />
          </div>
        </OrderSummaryDisclosure>
      </div>
    </div>
  )
}

export default CheckoutSummary
