import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import styles from "./style.module.scss"

type LineItemUnitPriceProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
  style?: "default" | "tight"
  currencyCode: string
}

const LineItemUnitPrice = ({
  item,
  style = "default",
  currencyCode,
}: LineItemUnitPriceProps) => {
  const total = item.total ?? 0
  const originalTotal = item.original_total ?? total
  const quantity = item.quantity || 1
  const hasReducedPrice = total < originalTotal

  const percentage_diff = Math.round(
    originalTotal > 0 ? ((originalTotal - total) / originalTotal) * 100 : 0
  )

  return (
    <div className={styles.root}>
      {hasReducedPrice && (
        <>
          <p>
            {style === "default" && (
              <span className={styles.originalLabel}>Původně: </span>
            )}
            <span
              className={styles.originalPrice}
              data-testid="product-unit-original-price"
            >
              {convertToLocale({
                amount: originalTotal / quantity,
                currency_code: currencyCode,
              })}
            </span>
          </p>
          {style === "default" && (
            <span className={styles.discount}>-{percentage_diff}%</span>
          )}
        </>
      )}
      <span
        className={clx(styles.price, {
          [styles.discounted]: hasReducedPrice,
        })}
        data-testid="product-unit-price"
      >
        {convertToLocale({
          amount: total / quantity,
          currency_code: currencyCode,
        })}
      </span>
    </div>
  )
}

export default LineItemUnitPrice
