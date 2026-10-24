import { getPercentageDiff } from "@lib/util/get-precentage-diff"
import { convertToLocale } from "@lib/util/money"
import {
  isPriceOnRequestLine,
  PRICE_ON_REQUEST_LINE_LABEL,
} from "@lib/util/price-on-request"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import styles from "./style.module.scss"

type LineItemPriceProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
  style?: "default" | "tight"
  currencyCode: string
}

const LineItemPrice = ({
  item,
  style = "default",
  currencyCode,
}: LineItemPriceProps) => {
  const currentPrice = item.total ?? 0
  const originalPrice = item.original_total ?? currentPrice
  const hasReducedPrice = currentPrice < originalPrice

  /* Cena po domluvě: řádek stojí 0 Kč, ale „0 Kč" by lhalo — cenu pošlu
     po objednávce e-mailem (lib/util/price-on-request). */
  if (currentPrice <= 0 && isPriceOnRequestLine(item as any)) {
    return (
      <div className={styles.root}>
        <div className={styles.priceContainer}>
          <span
            className={styles.price}
            data-testid="product-price"
            data-price-on-request="true"
          >
            {PRICE_ON_REQUEST_LINE_LABEL}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.priceContainer}>
        {hasReducedPrice && (
          <>
            <p>
              {style === "default" && (
                <span className={styles.originalLabel}>Původně: </span>
              )}
              <span
                className={styles.originalPrice}
                data-testid="product-original-price"
              >
                {convertToLocale({ amount: originalPrice, currency_code: currencyCode })}
              </span>
            </p>
            {style === "default" && (
              <span className={styles.discount}>
                -{getPercentageDiff(originalPrice, currentPrice || 0)}%
              </span>
            )}
          </>
        )}
        <span
          className={clx(styles.price, {
            [styles.discounted]: hasReducedPrice,
          })}
          data-testid="product-price"
        >
          {convertToLocale({ amount: currentPrice, currency_code: currencyCode })}
        </span>
      </div>
    </div>
  )
}

export default LineItemPrice
