import { getPercentageDiff } from "@lib/util/get-precentage-diff"
import { convertToLocale } from "@lib/util/money"
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
