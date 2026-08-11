"use client"

import { convertToLocale } from "@lib/util/money"
import styles from "./style.module.scss"

/**
 * What the customer is about to pay for, in one block: the objects, where they are going,
 * and the total including VAT. This is the "let me check everything once more" moment.
 */
export default function OrderRecap({ cart }: { cart: any }) {
  const currency_code = cart?.currency_code ?? "czk"
  const money = (amount?: number | null) =>
    convertToLocale({ amount: amount ?? 0, currency_code })

  const address = cart?.shipping_address
  const shippingMethod = cart?.shipping_methods?.at(-1)
  const pickupPoint = String(cart?.metadata?.packeta_pickup_point_label || "")

  return (
    <div className={styles.recap}>
      <section className={styles.recapBlock} aria-labelledby="recap-items">
        <h3 id="recap-items">Co objednáváte</h3>
        <ul className={styles.itemList}>
          {cart?.items?.map((item: any) => (
            <li key={item.id}>
              <span className={styles.itemTitle}>
                {item.product_title ?? item.title}
                {item.variant_title ? ` · ${item.variant_title}` : ""}
              </span>
              <span className={styles.itemQuantity}>{item.quantity}×</span>
              <span className={styles.itemTotal}>{money(item.total)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.recapColumns}>
        <section className={styles.recapBlock} aria-labelledby="recap-delivery">
          <h3 id="recap-delivery">Doručení</h3>
          {address ? (
            <p className={styles.recapText}>
              {address.first_name} {address.last_name}
              <br />
              {address.address_1}
              <br />
              {address.postal_code} {address.city}
              <br />
              {address.country_code?.toUpperCase()}
            </p>
          ) : (
            <p className={styles.recapText}>Adresu jste zatím nevyplnili.</p>
          )}
          {shippingMethod && (
            <p className={styles.recapNote}>
              {shippingMethod.name} · {money(shippingMethod.total)}
            </p>
          )}
          {/* The pickup point is the single detail most often lost between checkout and the
              confirmation; showing it here is the customer's last chance to catch a wrong one. */}
          {pickupPoint && (
            <p className={styles.pickupPoint}>
              <span>Výdejní místo</span>
              {pickupPoint}
            </p>
          )}
        </section>

        <section className={styles.recapBlock} aria-labelledby="recap-total">
          <h3 id="recap-total">Platba</h3>
          <dl className={styles.totals}>
            <div>
              <dt>Mezisoučet</dt>
              <dd>{money(cart?.subtotal)}</dd>
            </div>
            {Boolean(cart?.discount_total) && (
              <div>
                <dt>Sleva</dt>
                <dd>−{money(cart?.discount_total)}</dd>
              </div>
            )}
            <div>
              <dt>Doprava</dt>
              <dd>{money(cart?.shipping_total)}</dd>
            </div>
            <div className={styles.totalRow}>
              <dt>Celkem</dt>
              <dd>{money(cart?.total)}</dd>
            </div>
          </dl>
          <p className={styles.vatNote}>
            Včetně DPH {money(cart?.tax_total)}. Tolik zaplatíte.
          </p>
        </section>
      </div>
    </div>
  )
}
