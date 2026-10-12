"use client"

import { convertToLocale } from "@lib/util/money"
import { PLATCE_DPH } from "@lib/util/dph"
import { packagingSubtotal } from "@lib/util/packaging"
import React from "react"
import styles from "./style.module.scss"
import { Divider } from "@medusajs/ui"

/**
 * ## Proč `item_subtotal`, a ne `item_total`
 *
 * Sloupec se čte odshora dolů jako výpočet: mezisoučet, mínus sleva, plus
 * doprava, celkem. Aby to vycházelo, musí být mezisoučet částka PŘED slevou.
 *
 * `item_total` je součet položek PO odečtení akcí, takže se sleva započítala
 * dvakrát: naměřeno na košíku s 28% akcí — Mezisoučet 2 419, sleva −941,
 * Celkem 2 419. Ta první částka měla být 3 360.
 *
 * `item_subtotal` je týž součet před akcemi — tedy ta částka, od které se sleva
 * odečítá. 3 360 − 941 + 0 = 2 419.
 *
 * ## Proč sleva na zboží a doprava po slevě
 *
 * `discount_total` nese i slevu na dopravu. Kdyby ji ukazoval řádek Sleva
 * a zároveň řádek Doprava ukazoval cenu po slevě, odečetla by se dvakrát.
 * Sleva tedy mluví jen o zboží (`item_discount_total`) a doprava zdarma se
 * ukáže tam, kde jí zákazník rozumí — jako nula u dopravy.
 *
 * Stejně to počítá i shrnutí před odesláním (`checkout/components/review/
 * recap.tsx`) a hotová objednávka (`order/components/order-summary`). Tyhle
 * tři obrazovky ukazují touž objednávku a nesmí si každá počítat po svém.
 */
type CartTotalsProps = {
  totals: {
    total?: number | null
    item_total?: number | null
    item_subtotal?: number | null
    item_discount_total?: number | null
    subtotal?: number | null
    tax_total?: number | null
    shipping_total?: number | null
    discount_total?: number | null
    gift_card_total?: number | null
    currency_code: string
    shipping_subtotal?: number | null
    /** Položky košíku — z nich se mezisoučet rozloží na výrobky a balné. */
    items?: Array<{
      metadata?: Record<string, unknown> | null
      variant_id?: string | null
      product_id?: string | null
      quantity?: number | null
      unit_price?: number | null
    }> | null
  }
}



const CartTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const {
    currency_code,
    item_total,
    item_subtotal,
    item_discount_total,
    total,
    subtotal,
    tax_total,
    discount_total,
    gift_card_total,
    shipping_subtotal,
    shipping_total,
  } = totals
  const subtotalAmount = item_subtotal ?? item_total ?? 0
  // Rozpad mezisoučtu „Výrobky / Balné" (Matěj 12. 10.).
  const packaging = packagingSubtotal(totals.items)
  return (
    <div className={styles.root}>
      <div className={styles.totalsList}>
        <div className={styles.row}>
          <span className={styles.label}>
            Mezisoučet
          </span>
          {/* `?? item_total` je záchrana pro volajícího, který `item_subtotal`
              nemá — bez slevy jsou obě částky stejné, takže se nic nezhorší. */}
          <span
            className={styles.subtotal}
            data-testid="cart-subtotal"
            data-value={item_subtotal ?? item_total ?? 0}
          >
            {convertToLocale({
              amount: subtotalAmount,
              currency_code,
            })}
          </span>
        </div>
        {/* Rozpad mezisoučtu: výrobky a balné, odsazeně pod ním. */}
        {packaging !== null && (
          <div className={styles.breakdown} data-testid="cart-subtotal-breakdown">
            <div className={styles.subRow}>
              <span>Výrobky</span>
              <span>
                {convertToLocale({ amount: subtotalAmount - packaging, currency_code })}
              </span>
            </div>
            <div className={styles.subRow}>
              <span>Balné</span>
              <span data-testid="cart-packaging">
                {convertToLocale({ amount: packaging, currency_code })}
              </span>
            </div>
          </div>
        )}
        {!!(item_discount_total ?? discount_total) && (
          <div className={styles.row}>
            <span className={styles.label}> sleva</span>
            <span
              className={styles.discount}
              data-testid="cart-discount"
              data-value={item_discount_total ?? discount_total ?? 0}
            >
              -{" "}
              {convertToLocale({
                amount: item_discount_total ?? discount_total ?? 0,
                currency_code,
              })}
            </span>
          </div>
        )}
        <Divider />
        <div className={styles.taxRow}>
          <span className={styles.label}>Doprava</span>
          {/* Po slevě: doprava zdarma se ukáže jako nula tady, ne jako další
              položka v řádku Sleva. */}
          <span
            data-testid="cart-shipping"
            data-value={shipping_total ?? shipping_subtotal ?? 0}
            className={styles.labelValue}
          >
            {convertToLocale({
              amount: shipping_total ?? shipping_subtotal ?? 0,
              currency_code,
            })}
          </span>
        </div>
        {/* Jen pro plátce DPH — viz `lib/util/dph.ts`. */}
        {PLATCE_DPH && (
          <div className={styles.taxRow}>
            <span className={styles.label}>Daně</span>
            <span
              data-testid="cart-taxes"
              data-value={tax_total || 0}
              className={styles.labelValue}
            >
              {convertToLocale({ amount: tax_total ?? 0, currency_code })}
            </span>
          </div>
        )}
        {!!gift_card_total && (
          <div className={styles.row}>
            <span className={styles.label}>Dárkové karty</span>
            <span
              className={styles.giftCard}
              data-testid="cart-gift-card-amount"
              data-value={gift_card_total || 0}
            >
              -{" "}
              {convertToLocale({ amount: gift_card_total ?? 0, currency_code })}
            </span>
          </div>
        )}
      </div>
      <div className={styles.divider} />
      <div className={styles.totalRow}>
        <span className={styles.total}>
          Celkem
          {PLATCE_DPH && <em className={styles.vatNote}>včetně DPH</em>}
        </span>
        <span
          className={styles.totalValue}
          data-testid="cart-total"
          data-value={total || 0}
        >
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </span>
      </div>
  <div className={`${styles.divider} ${styles.mt}`} />
    </div>
  )
}

export default CartTotals
