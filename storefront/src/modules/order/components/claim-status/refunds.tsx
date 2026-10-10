import {
  REFUND_METHOD_TEXT,
  formatClaimDate,
  refundLineLabel,
  refundLines,
  type ClaimOrderItem,
  type ClaimRefund,
  type OrderClaim,
} from "@lib/util/claims"
import { convertToLocale } from "@lib/util/money"

import styles from "./style.module.scss"

/**
 * Refundace jedné žádosti (§13.2–13.3) — každá zvlášť: částka a datum, řádky
 * košíku vrácení (položka × ks / poštovné / jiná částka), jak peníze dorazí
 * (karta přes ComGate / převodem) a odkaz na dobropis, když je vystavený.
 *
 * Bez `"use client"` schválně, stejně jako `line-items`: nic interaktivního.
 * Starší refundace bez `lines` ukážou jen částku, způsob a případný dobropis.
 */
export default function ClaimRefundsList({
  claim,
  refunds,
  orderItems,
  currencyCode,
}: {
  claim: OrderClaim
  refunds: ClaimRefund[]
  /** Položky objednávky — k dohledání názvu, když ho řádek refundace nenese. */
  orderItems?: ClaimOrderItem[] | null
  currencyCode: string
}) {
  if (!refunds.length) return null

  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: currencyCode })

  return (
    <div className={styles.refunds} aria-label="Vrácené peníze">
      <span className={styles.refundsLabel}>Vrácené peníze</span>
      <ul className={styles.refundList}>
        {refunds.map((refund, index) => {
          const lines = refundLines(refund)
          const creditNote = refund.credit_note
          const methodText =
            REFUND_METHOD_TEXT[refund.method] ?? REFUND_METHOD_TEXT.manual
          return (
            <li key={`${refund.at || "refund"}-${index}`} className={styles.refund}>
              <div className={styles.refundHead}>
                <strong>{money(refund.amount)}</strong>
                {refund.at && (
                  <time dateTime={refund.at}>{formatClaimDate(refund.at)}</time>
                )}
              </div>
              {lines.length > 0 && (
                <ul className={styles.refundLines}>
                  {lines.map((line, lineIndex) => (
                    <li key={lineIndex}>
                      <span>{refundLineLabel(line, claim, orderItems)}</span>
                      {typeof line.amount === "number" && line.amount > 0 && (
                        <span>{money(line.amount)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.refundMethod}>{methodText}</p>
              {refund.note && (
                <p className={styles.refundNote}>{refund.note}</p>
              )}
              {creditNote?.pdf_url ? (
                <a
                  className={styles.protocol}
                  href={creditNote.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Opravný daňový doklad (dobropis)
                  {creditNote.number ? ` č. ${creditNote.number}` : ""}{" "}
                  <i aria-hidden="true">↗</i>
                </a>
              ) : creditNote?.number ? (
                <p className={styles.refundNote}>
                  Opravný daňový doklad (dobropis) č. {creditNote.number}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
