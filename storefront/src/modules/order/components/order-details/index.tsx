import { HttpTypes } from "@medusajs/types"
import { translateStatus } from "@lib/i18n/statuses"
import type { OrderTermsRef } from "@lib/legal/order-terms"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import styles from "../styles/order-details.module.scss"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
  /** Stav ze serveru (reklamace, odesláno, výroba…); přednost před stavem Medusy. */
  statusLabel?: string | null
  /**
   * Znění OP, podle kterého se objednávka uzavřela — archiv smlouvy, který
   * OP čl. III a IV slibují v účtu. Spočítá ho serverová stránka
   * (`orderTermsRef`); bez něj se řádek nevykreslí.
   */
  terms?: OrderTermsRef | null
}

const OrderDetails = ({ order, showStatus, statusLabel, terms }: OrderDetailsProps) => {
  const formattedDate = new Date(order.created_at).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <section className={styles.accountOrderMetaRoot}>
      <div className={styles.accountOrderConfirmation}>
        <span>Potvrzení objednávky</span>
        <p>
          Potvrzení jsme poslali na{" "}
          <strong data-testid="order-email">{order.email}</strong>
        </p>
      </div>
      {terms && (
        <div className={styles.accountOrderConfirmation} data-testid="order-terms">
          <span>Obchodní podmínky</span>
          <p>
            <LocalizedClientLink href={terms.href}>
              Znění od {terms.validFrom}
            </LocalizedClientLink>
            {terms.pdfUrl && (
              <>
                {" · "}
                <a href={terms.pdfUrl} target="_blank" rel="noopener noreferrer">
                  PDF
                </a>
              </>
            )}
          </p>
        </div>
      )}
      <dl className={styles.accountOrderMetaGrid}>
        <div>
          <dt>Vytvořeno</dt>
          <dd data-testid="order-date">{formattedDate}</dd>
        </div>
        <div>
          <dt>Číslo objednávky</dt>
          <dd data-testid="order-id">#{order.display_id}</dd>
        </div>
        {showStatus && (
          <>
            <div>
              <dt>Stav objednávky</dt>
              <dd data-testid="order-status">
                {statusLabel ||
                  translateStatus(order.fulfillment_status, "fulfillment", "cs")}
              </dd>
            </div>
            <div>
              <dt>Stav platby</dt>
              <dd data-testid="order-payment-status">
                {translateStatus(order.payment_status, "payment", "cs")}
              </dd>
            </div>
          </>
        )}
      </dl>
    </section>
  )
}

export default OrderDetails
