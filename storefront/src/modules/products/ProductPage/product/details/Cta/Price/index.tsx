import { getProductPrice } from "@lib/util/get-product-price"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

/**
 * Přeškrtnutá původní cena u poškozeného kusu — bez price-listu.
 *
 * Běžná sleva jede přes Medusa price-list (`price_type === "sale"`) a blok níž
 * ji umí. Poškozený kus ale žádnou slevu v Slevy+ nezakládá (záměr majitelky):
 * jeho cena JE ta akční a „původní" cena se drží v `metadata.clearance_original_price`.
 * Tahle větev ji přečte a vykreslí přeškrtnutí + procento stejnými třídami jako
 * price-listová sleva, takže to na webu vypadá identicky. Mimo poškozené kusy
 * (klíč chybí) se nevykreslí nic navíc.
 */
const clearanceOriginal = (
  product: HttpTypes.StoreProduct,
  calculatedNumber: number | undefined
): { label: string; percent: number } | null => {
  const meta = (product.metadata ?? null) as Record<string, unknown> | null
  const raw = meta?.clearance_original_price
  const original = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(original) || original <= 0) return null
  if (calculatedNumber == null || original <= calculatedNumber) return null

  return {
    label: String(
      convertToLocale({ amount: original, currency_code: "czk" })
    ).replace(/czk/i, "").trim(),
    percent: Math.round(((original - calculatedNumber) / original) * 100),
  }
}

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
  const isSale = selectedPrice?.price_type === "sale"

  // Poškozený kus ukazuje původní cenu z metadat — ale jen když zrovna neběží
  // price-listová sleva, aby se přeškrtnutí nezdvojilo.
  const clearance = !isSale
    ? clearanceOriginal(product, selectedPrice?.calculated_price_number)
    : null

  return (
    <div className="product__details__cta__price">
      <p>Cena |</p>
      <div className="product__details__cta__price__main">
        <span
          className={[
            "product__priceCurrent",
            isSale || clearance ? "product__priceCurrent--sale" : "",
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
        {isSale && (
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
        {!isSale && clearance && (
          <>
            <p>
              <span className="product__priceOriginalLabel">Původní cena: </span>
              <span
                className="product__priceOriginal"
                data-testid="original-product-price"
              >
                {clearance.label}
              </span>
            </p>
            <span className="product__priceDiscount">-{clearance.percent}%</span>
          </>
        )}
      </div>
    </div>
  )
}
