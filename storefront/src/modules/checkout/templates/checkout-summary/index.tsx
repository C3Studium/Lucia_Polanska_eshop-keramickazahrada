import OrderSummaryDisclosure from "@modules/checkout/components/order-summary-disclosure"
import DiscountCode from "@modules/checkout/components/discount-code"
import CheckoutCommissionBriefs from "@modules/checkout/components/commission-briefs"
import ProductionPaymentRecap from "@modules/checkout/components/production-payment-recap"
import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import type { ProductionPaymentMode } from "@lib/util/made-to-order"
import { listCartShippingMethods } from "@lib/data/fulfillment"
import { shippingFromOptions } from "@modules/cart/shipping-from"
import CmsText from "@modules/common/components/cms-text"
import { itemFieldPath, itemText } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import styles from "./style.module.scss"

const CheckoutSummary = async ({
  cart,
  productionMode,
  copy,
}: {
  cart: any
  productionMode?: ProductionPaymentMode | null
  /** Blok `pokladna.souhrn` — obočí (`oboci`) a nadpis (`nadpis`) souhrnu. */
  copy?: CopyBlock
}) => {
  const doc = copy?.id ?? null
  /* Než je doprava zvolená, souhrn neukazuje „Doprava 0 Kč", ale „od …"
     (stejně jako košík). Dotaz sdílí cache s krokem Doprava. */
  const shippingFrom = !(cart?.shipping_methods?.length ?? 0)
    ? shippingFromOptions(
        await listCartShippingMethods(cart.id).catch(() => null),
        cart
      )
    : null

  return (
    /*
      data-lenis-prevent: od 1021px je tenhle sloupec lepkavý a má vlastní
      posuv (`max-height` + `overflow-y`), jenže stránka jede na Lenisu —
      ten kolečko sebere pro stránku a uvnitř se neposune nic. U zakázky je
      souhrn nejvyšší (položky + součty + záloha + brief), takže se spodek
      bez tohohle atributu nedal dorolovat vůbec.
    */
    <div className={styles.root} data-lenis-prevent>
      <div className={styles.summary}>
        <CmsText as="p" className={styles.eyebrow} doc={doc} field={itemFieldPath(copy, "oboci")}>
          {itemText(copy, "oboci", "Přehled objednávky")}
        </CmsText>
        <CmsText as="h2" className={styles.heading} doc={doc} field={itemFieldPath(copy, "nadpis")}>
          {itemText(copy, "nadpis", "Co objednáváte")}
        </CmsText>
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
          <CartTotals totals={cart} shippingFrom={shippingFrom} />
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
