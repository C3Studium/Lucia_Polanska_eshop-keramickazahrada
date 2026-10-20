import { HttpTypes } from "@medusajs/types"
import { getPercentageDiff } from "./get-precentage-diff"
import { convertToLocale } from "./money"

export const getPricesForVariant = (variant: any) => {
  if (!variant?.calculated_price?.calculated_amount) {
    return null
  }

  return {
    /** Varianta, ke které cena patří — klíč pro referenční cenu § 12a. */
    variant_id: variant.id as string | undefined,
    calculated_price_number: variant.calculated_price.calculated_amount,
    calculated_price: convertToLocale({
      amount: variant.calculated_price.calculated_amount,
      currency_code: variant.calculated_price.currency_code,
    }),
    original_price_number: variant.calculated_price.original_amount,
    original_price: convertToLocale({
      amount: variant.calculated_price.original_amount,
      currency_code: variant.calculated_price.currency_code,
    }),
    currency_code: variant.calculated_price.currency_code,
    price_type: variant.calculated_price.calculated_price.price_list_type,
    percentage_diff: getPercentageDiff(
      variant.calculated_price.original_amount,
      variant.calculated_price.calculated_amount
    ),
  }
}

/**
 * Sleva v procentech proti nejnižší ceně za 30 dní před slevou (§ 12a ZOS),
 * ne proti běžné ceně. Zaokrouhluje DOLŮ, aby se sleva nikdy nenadsadila.
 * `null`, když reference chybí nebo aktuální cena pod ní není aspoň o 1 % —
 * taková „sleva" se jako sleva ukazovat nesmí.
 */
export const discountFromReference = (
  current: number | null | undefined,
  lowest30d: number | null | undefined
): number | null => {
  if (
    current == null ||
    lowest30d == null ||
    !Number.isFinite(current) ||
    !Number.isFinite(lowest30d) ||
    lowest30d <= 0
  ) {
    return null
  }
  const percent = Math.floor(((lowest30d - current) / lowest30d) * 100)
  return percent >= 1 ? percent : null
}

/**
 * Kus s vadou („Poškozené", `metadata.clearance`). Jeho cena není sleva, ale
 * cena kusu s vadou — § 12a se na něj nevztahuje a přeškrtnutá „původní"
 * cena ani procento se u něj neukazují.
 */
export const clearanceInfo = (
  product: Pick<HttpTypes.StoreProduct, "metadata"> | null | undefined
): { damage: string | null } | null => {
  const meta = (product?.metadata ?? null) as Record<string, unknown> | null
  if (!meta) return null
  const damage =
    typeof meta.clearance_damage === "string" && meta.clearance_damage.trim()
      ? meta.clearance_damage.trim()
      : null
  const original = Number(meta.clearance_original_price)
  const isClearance =
    meta.clearance === true ||
    damage != null ||
    (Number.isFinite(original) && original > 0)
  return isClearance ? { damage } : null
}

export function getProductPrice({
  product,
  variantId,
}: {
  product: HttpTypes.StoreProduct
  variantId?: string
}) {
  if (!product || !product.id) {
    throw new Error("No product provided")
  }

  const cheapestPrice = () => {
    if (!product || !product.variants?.length) {
      return null
    }

    const cheapestVariant: any = product.variants
      .filter((v: any) => !!v.calculated_price)
      .sort((a: any, b: any) => {
        return (
          a.calculated_price.calculated_amount -
          b.calculated_price.calculated_amount
        )
      })[0]

    return getPricesForVariant(cheapestVariant)
  }

  const variantPrice = () => {
    if (!product || !variantId) {
      return null
    }

    const variant: any = product.variants?.find(
      (v) => v.id === variantId || v.sku === variantId
    )

    if (!variant) {
      return null
    }

    return getPricesForVariant(variant)
  }

  return {
    product,
    cheapestPrice: cheapestPrice(),
    variantPrice: variantPrice(),
  }
}
