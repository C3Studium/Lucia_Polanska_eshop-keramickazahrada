import { convertToLocale } from "@lib/util/money"
import type { OrderProgress } from "@lib/data/order-progress"

import styles from "./style.module.scss"

type Props = {
  progress: OrderProgress | null
  /** Shown when the merchant workflow has no stage for this order yet. */
  fallbackLabel: string
}

/**
 * Where the order is, and what is still owed.
 *
 * `stage_label` is displayed **verbatim**. It is not a translation of the internal stage name —
 * the backend deliberately says „Chystáme k odeslání" for a packed order rather than anything
 * that reads as *already sent*, and „Čeká na platbu" rather than „Problém s platbou".
 * Re-wording it here would undo that.
 */
export default function OrderProgressPanel({ progress, fallbackLabel }: Props) {
  const label = progress?.stage_label || fallbackLabel
  const balance = progress?.balance

  return (
    <section className={styles.root} aria-label="Stav objednávky">
      <div className={styles.stage}>
        <span className={styles.eyebrow}>Stav objednávky</span>
        <strong className={styles.label}>{label}</strong>
      </div>

      {balance && balance.outstanding > 0 && (
        <div className={styles.balance}>
          <p className={styles.balanceCopy}>
            Zbývá doplatit{" "}
            <strong>
              {convertToLocale({
                amount: balance.outstanding,
                currency_code: balance.currency_code,
              })}
            </strong>
            .
          </p>
          {/* The URL is signed by the backend; it is read, never built. */}
          <a className={styles.payButton} href={balance.payment_url}>
            Doplatit{" "}
            {convertToLocale({
              amount: balance.outstanding,
              currency_code: balance.currency_code,
            })}
          </a>
        </div>
      )}
    </section>
  )
}
