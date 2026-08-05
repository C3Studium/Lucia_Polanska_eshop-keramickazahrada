"use client"

import { convertToLocale } from "@lib/util/money"
import React from "react"
import styles from "./style.module.scss"
import { Divider } from "@medusajs/ui"

type CartTotalsProps = {
  totals: {
    total?: number | null
    item_total?: number | null
    subtotal?: number | null
    tax_total?: number | null
    shipping_total?: number | null
    discount_total?: number | null
    gift_card_total?: number | null
    currency_code: string
    shipping_subtotal?: number | null
  }
}

const CartTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const {
    currency_code,
    item_total,
    total,
    subtotal,
    tax_total,
    discount_total,
    gift_card_total,
    shipping_subtotal,
  } = totals
  return (
    <div className={styles.root}>
      <div className={styles.totalsList}>
        <div className={styles.row}>
          <span className={styles.label}>
            Mezisoučet
          </span>
          <span className={styles.subtotal} data-testid="cart-subtotal" data-value={item_total || 0}>
            {convertToLocale({ amount: item_total ?? 0, currency_code })}
          </span>
        </div>
        {!!discount_total && (
          <div className={styles.row}>
            <span className={styles.label}> sleva</span>
            <span
              className={styles.discount}
              data-testid="cart-discount"
              data-value={discount_total || 0}
            >
              -{" "}
              {convertToLocale({ amount: discount_total ?? 0, currency_code })}
            </span>
          </div>
        )}
        <Divider />
        <div className={styles.taxRow}>
          <span className={styles.label}>Doprava</span>
          <span data-testid="cart-shipping" data-value={shipping_subtotal || 0} className={styles.labelValue}>
            {convertToLocale({ amount: shipping_subtotal ?? 0, currency_code })}
          </span>
        </div>
        <div className={styles.taxRow}>
          <span className={styles.label}>Daně</span>
          <span data-testid="cart-taxes" data-value={tax_total || 0} className={styles.labelValue}>
            {convertToLocale({ amount: tax_total ?? 0, currency_code })}
          </span>
        </div>
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
          Celkem <em className={styles.vatNote}>včetně DPH</em>
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
