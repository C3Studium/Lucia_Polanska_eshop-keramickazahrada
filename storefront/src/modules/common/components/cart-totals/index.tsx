"use client"

import { convertToLocale } from "@lib/util/money"
import { PLATCE_DPH } from "@lib/util/dph"
import { dobirkaFeeSubtotal, packagingSubtotal } from "@lib/util/packaging"
import { discountRowLabel } from "@lib/util/gift-voucher-code"
import {
  hasPriceOnRequestLine,
  PRICE_ON_REQUEST_SUMMARY_NOTE,
} from "@lib/util/price-on-request"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { ShippingFrom } from "@modules/cart/shipping-from"
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
      /** Jen kvůli větě o ceně po domluvě (`isPriceOnRequestLine`). */
      product?: {
        categories?: { handle?: string | null }[] | null
        metadata?: Record<string, any> | null
      } | null
    }> | null
    /** Zvolená doprava — bez ní se místo „0 Kč" ukáže „od …" / ceník. */
    shipping_methods?: unknown[] | null
    /** Uplatněné akce — podle nich se řádek slevy u dárkového poukazu přejmenuje. */
    promotions?: Array<{ code?: string | null; is_automatic?: boolean | null }> | null
  }
  /** Nejlevnější doprava pro tenhle košík (`shippingFromOptions`), dokud žádná není zvolená. */
  shippingFrom?: ShippingFrom | null
}

/**
 * Řádek Doprava, dokud zákazník dopravu nevybral: „od 79 Kč" (v měně
 * košíku — u SK v eurech), a když cenu předem neznáme, odkaz na ceník.
 * Dřív tu stálo „0 Kč", tedy doprava zdarma, což neplatí (§ 1820 OZ chce
 * cenu dopravy předem).
 */
export const ShippingNotChosen = ({
  shippingFrom,
  currency_code,
}: {
  shippingFrom?: ShippingFrom | null
  currency_code: string
}) =>
  shippingFrom?.amount != null ? (
    <>
      {shippingFrom.amount === 0
        ? "zdarma"
        : `od ${convertToLocale({ amount: shippingFrom.amount, currency_code })}`}
    </>
  ) : (
    <>
      podle zvolené dopravy —{" "}
      <LocalizedClientLink href="/doprava-a-platba" target="_blank" rel="noopener">
        ceník
      </LocalizedClientLink>
    </>
  )

const CartTotals: React.FC<CartTotalsProps> = ({ totals, shippingFrom }) => {
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
  // Rozpad mezisoučtu „Výrobky / Balné" (Matěj 12. 10.). Doběrečné je taky
  // položka košíku (je v mezisoučtu), ale výrobek to není — vlastní řádek.
  const packaging = packagingSubtotal(totals.items)
  const dobirkaFee = dobirkaFeeSubtotal(totals.items)
  const showBreakdown = packaging !== null || dobirkaFee !== null
  /* Bez zvolené dopravy je `shipping_total` 0 — to není „zdarma", to je
     „ještě nevíme". `shipping_methods` neposílá každý volající; kdo ho
     nemá, chová se jako dřív. */
  const shippingChosen =
    !Array.isArray(totals.shipping_methods) || totals.shipping_methods.length > 0
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
        {/* Rozpad mezisoučtu: výrobky, balné a doběrečné, odsazeně pod ním.
            „Výrobky" jsou mezisoučet BEZ obou poplatků — dřív se 39 Kč
            doběrečného počítalo do výrobků. */}
        {showBreakdown && (
          <div className={styles.breakdown} data-testid="cart-subtotal-breakdown">
            <div className={styles.subRow}>
              <span>Výrobky</span>
              <span data-testid="cart-products-subtotal">
                {convertToLocale({
                  amount: subtotalAmount - (packaging ?? 0) - (dobirkaFee ?? 0),
                  currency_code,
                })}
              </span>
            </div>
            {packaging !== null && (
              <div className={styles.subRow}>
                <span>Balné</span>
                <span data-testid="cart-packaging">
                  {convertToLocale({ amount: packaging, currency_code })}
                </span>
              </div>
            )}
            {dobirkaFee !== null && (
              <div className={styles.subRow}>
                <span>Doběrečné</span>
                <span data-testid="cart-dobirka-fee">
                  {convertToLocale({ amount: dobirkaFee, currency_code })}
                </span>
              </div>
            )}
          </div>
        )}
        {!!(item_discount_total ?? discount_total) && (
          <div className={styles.row}>
            {/* Poukaz je slevová akce, takže sedí v témž součtu — řádek se
                jen jmenuje podle toho, co v něm je. */}
            <span className={styles.label}>
              {discountRowLabel(totals.promotions) ?? " sleva"}
            </span>
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
            data-value={shippingChosen ? shipping_total ?? shipping_subtotal ?? 0 : ""}
            className={styles.labelValue}
          >
            {shippingChosen ? (
              convertToLocale({
                amount: shipping_total ?? shipping_subtotal ?? 0,
                currency_code,
              })
            ) : (
              <ShippingNotChosen
                shippingFrom={shippingFrom}
                currency_code={currency_code}
              />
            )}
          </span>
        </div>
        {!shippingChosen && shippingFrom?.pickupFree && (shippingFrom.amount ?? 0) > 0 && (
          <div className={styles.breakdown}>
            <div className={styles.subRow}>
              <span>Osobní odběr v ateliéru</span>
              <span>zdarma</span>
            </div>
          </div>
        )}
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
          {!shippingChosen && <em className={styles.vatNote}>bez dopravy</em>}
        </span>
        <span
          className={styles.totalValue}
          data-testid="cart-total"
          data-value={total || 0}
        >
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </span>
      </div>
      {hasPriceOnRequestLine(totals.items as any) && (
        <p className={styles.priceOnRequestNote} data-testid="cart-price-on-request-note">
          {PRICE_ON_REQUEST_SUMMARY_NOTE}
        </p>
      )}
  <div className={`${styles.divider} ${styles.mt}`} />
    </div>
  )
}

export default CartTotals
