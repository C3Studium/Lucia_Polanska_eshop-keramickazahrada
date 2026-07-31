import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"

export default function ProductPrice({
  product,
  variant,
  className,
  countryCode
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  className?: string
  countryCode: string
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  })

  const selectedPrice = variant ? variantPrice : cheapestPrice
  const calculatedPrice = selectedPrice?.calculated_price
  const originalPrice = selectedPrice?.original_price
  const hasPrice = calculatedPrice != null

  return (
    <div className="product__details__cta__price">
      <p>Cena |</p>
      <div className="product__details__cta__price__main">
        <span
          className={[
            "product__priceCurrent",
            selectedPrice?.price_type === "sale" ? "product__priceCurrent--sale" : "",
            !hasPrice ? "product__priceUnavailable" : "",
            className ?? "",
          ].filter(Boolean).join(" ")}
          data-testid="product-price"
          data-value={selectedPrice?.calculated_price_number}
        >
          {hasPrice
            ? String(calculatedPrice).replace(/czk/i, "").trim()
            : "Cena na dotaz"}
        </span>
        {selectedPrice?.price_type === "sale" && (
          <>
            <p>
              <span className="product__priceOriginalLabel">Původní cena: </span>
              <span
                className="product__priceOriginal"
                data-testid="original-product-price"
                data-value={selectedPrice.original_price_number}
              >
                {originalPrice !== undefined
                  ? String(originalPrice).replace(/czk/i, "").trim()
                  : "Na dotaz"}
              </span>
            </p>
            <span className="product__priceDiscount">
              -{selectedPrice.percentage_diff}%
            </span>
          </>
        )}
      </div>
    </div>
  )
}
