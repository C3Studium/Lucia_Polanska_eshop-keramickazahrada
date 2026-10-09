import {
  claimItemsTotal,
  claimLineItems,
  type OrderClaim,
} from "@lib/util/claims"
import { convertToLocale } from "@lib/util/money"
import Thumbnail from "@modules/products/components/thumbnail"

import styles from "./style.module.scss"

/**
 * Položky žádosti (§11.1) — náhled, název · varianta, počet, částka — a pod
 * nimi „Cena vybraných položek" (Σ `line_items.total`, §11.2). Když už byly
 * vráceny peníze, vedle součtu i „Vráceno", ať zákazník vidí, zda dostal celou
 * cenu vybraných kusů nebo jen část (sleva z ceny, částečná refundace).
 *
 * Bez direktivy `"use client"` schválně: čtou ho klientská časová osa i
 * serverový souhrn na potvrzení. Nic interaktivního tu není.
 *
 * Staré žádosti `line_items` nemají → nevykreslí se nic a karta vypadá jako
 * dřív (text `reason` nese, co se vracelo).
 */
export default function ClaimLineItems({
  claim,
  currencyCode,
  compact = false,
}: {
  claim: OrderClaim
  /** Měna objednávky; položka si může nést vlastní `currency_code`, ta má přednost. */
  currencyCode: string
  /** Souhrn na potvrzení: menší náhledy, bez jednotkové ceny a poznámky. */
  compact?: boolean
}) {
  const items = claimLineItems(claim)
  if (!items.length) return null

  const money = (amount: number, code?: string | null) =>
    convertToLocale({ amount, currency_code: code || currencyCode })
  const sumCurrency = items[0]?.currency_code
  const total = claimItemsTotal(claim) ?? 0
  const refunded = Number(claim.refund_amount) || 0
  const partial = refunded > 0 && refunded + 0.005 < total

  return (
    <div
      className={`${styles.lineItems} ${compact ? styles.lineItemsCompact : ""}`}
    >
      <ul className={styles.lineList}>
        {items.map((item, index) => (
          <li
            key={item.line_item_id ?? `${item.title}-${index}`}
            className={styles.lineItem}
          >
            <span className={styles.lineThumb}>
              <Thumbnail thumbnail={item.thumbnail} size="square" />
            </span>
            <span className={styles.lineBody}>
              <span className={styles.lineTitle}>{item.title}</span>
              <span className={styles.lineMeta}>
                {item.variant_title ? `${item.variant_title} · ` : ""}
                {item.quantity} ks
                {!compact && item.quantity > 1
                  ? ` × ${money(item.unit_price, item.currency_code)}`
                  : ""}
              </span>
            </span>
            <span className={styles.lineAmount}>
              {money(item.total, item.currency_code)}
            </span>
          </li>
        ))}
      </ul>
      <dl className={styles.lineSum}>
        <div>
          <dt>Cena vybraných položek</dt>
          <dd>{money(total, sumCurrency)}</dd>
        </div>
        {refunded > 0 && (
          <div data-tone={partial ? "partial" : "full"}>
            <dt>Vráceno</dt>
            <dd>{money(refunded, sumCurrency)}</dd>
          </div>
        )}
      </dl>
      {!compact && partial && (
        <p className={styles.lineNote}>
          Vráceno méně než cena vybraných položek — důvod najdete v protokolu a
          v e-mailu o vyřízení.
        </p>
      )}
    </div>
  )
}
