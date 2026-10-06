import OrderSummaryDisclosure from "@modules/checkout/components/order-summary-disclosure"
import DiscountCode from "@modules/checkout/components/discount-code"
import CheckoutCommissionBriefs from "@modules/checkout/components/commission-briefs"
import ProductionPaymentRecap from "@modules/checkout/components/production-payment-recap"
import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import type { ProductionPaymentMode } from "@lib/util/made-to-order"
import styles from "./style.module.scss"

const CheckoutSummary = ({
  cart,
  productionMode,
}: {
  cart: any
  productionMode?: ProductionPaymentMode | null
}) => {
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

      {/*
        Zjednodušená připomínka zálohy („zaplatíte teď / zbývá doplatit") nad
        briefem — plný widget se slajderem je v kroku Platba, tady je jen
        přehled zvolené částky. Jen na širokém rozvržení, stejně jako brief:
        na telefonu ji supluje widget v toku Platby.
      */}
      <div className={styles.paymentRecap}>
        <ProductionPaymentRecap mode={productionMode} />
      </div>

      {/*
        Brief zakázky (poznámka + fotky) pod slevovým kódem v pravém sloupci —
        jen na širokém rozvržení. Na telefonu/tabletu na výšku je schovaný
        (`commissionBriefs` ho pod 1020px skryje) a ukáže se v toku Přehledu.
        Pro běžný košík (bez zakázky) komponenta nevykreslí nic.
      */}
      <div className={styles.commissionBriefs}>
        <CheckoutCommissionBriefs cart={cart} />
      </div>
    </div>
  )
}

export default CheckoutSummary
