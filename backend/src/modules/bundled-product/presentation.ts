const one = <T>(value: T | T[] | undefined | null): T | undefined =>
  Array.isArray(value) ? value[0] : value ?? undefined

const amountOf = (variant: any): number | null => {
  const amount = Number(variant?.calculated_price?.calculated_amount)
  return Number.isFinite(amount) ? amount : null
}

/**
 * How many of this bundle a single variant could supply.
 *
 * `Infinity` when stock is not the limit (untracked, or backorders allowed) —
 * so it never becomes the constraint in a `Math.min`, which is exactly what it
 * means.
 */
const variantCapacity = (variant: any, quantity = 1): number => {
  if (!variant) {
    return 0
  }
  if (!variant.manage_inventory || variant.allow_backorder) {
    return Number.POSITIVE_INFINITY
  }
  const inventory = Number(variant.inventory_quantity)
  if (!Number.isFinite(inventory) || quantity <= 0) {
    return 0
  }
  return Math.floor(inventory / quantity)
}

const isVariantAvailable = (variant: any, quantity = 1) => {
  if (!variant) {
    return false
  }
  if (!variant.manage_inventory || variant.allow_backorder) {
    return true
  }
  const inventory = Number(variant.inventory_quantity)
  return Number.isFinite(inventory) && inventory >= quantity
}

export function presentBundle(bundle: any) {
  const orderedItems = [...(bundle.items ?? [])]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((item) => {
      const product = one(item.product)
      const fixedVariant = one(item.product_variant)
      const variants = product?.variants ?? []
      const availableVariants = variants.filter((variant: any) =>
        isVariantAvailable(variant, item.quantity)
      )
      const prices = variants.map(amountOf).filter((price): price is number => price !== null)

      return {
        ...item,
        product,
        product_variant: fixedVariant,
        fixed_variant_id: fixedVariant?.id ?? null,
        available_variant_ids: availableVariants.map((variant: any) => variant.id),
        is_available: item.variant_mode === "fixed_variant"
          ? isVariantAvailable(fixedVariant, item.quantity)
          : availableVariants.length > 0,
        // How many bundles this component alone could supply. When the customer
        // picks the variant, the best one is what matters — she is not limited
        // by the colour nobody chose.
        capacity:
          item.variant_mode === "fixed_variant"
            ? variantCapacity(fixedVariant, item.quantity)
            : variants.reduce(
                (best: number, variant: any) =>
                  Math.max(best, variantCapacity(variant, item.quantity)),
                0
              ),
        price_range: {
          min: prices.length ? Math.min(...prices) : null,
          max: prices.length ? Math.max(...prices) : null,
        },
      }
    })

  const componentMin = orderedItems.reduce(
    (sum, item) => sum + Number(item.price_range.min ?? 0) * item.quantity,
    0
  )
  const componentMax = orderedItems.reduce(
    (sum, item) => sum + Number(item.price_range.max ?? 0) * item.quantity,
    0
  )
  let min = componentMin
  let max = componentMax
  if (bundle.pricing_mode === "component_sum_discount") {
    const multiplier = 1 - Number(bundle.discount_percentage ?? 0) / 100
    min = Math.round(componentMin * multiplier)
    max = Math.round(componentMax * multiplier)
  } else if (bundle.pricing_mode === "fixed_price") {
    const bundleProduct = one(bundle.product)
    const amount = amountOf(bundleProduct?.variants?.[0])
    min = amount ?? 0
    max = amount ?? 0
  }

  return {
    ...bundle,
    product: one(bundle.product),
    items: orderedItems,
    availability: (() => {
      // A bundle can only be sold as often as its scarcest component allows
      // (§11). Naming that component is the useful half: „4 available" tells
      // her nothing, „4, limited by Miska modrá" tells her what to make.
      const limiting = orderedItems.reduce(
        (worst: any, item: any) =>
          worst === null || item.capacity < worst.capacity ? item : worst,
        null as any
      )
      const capacity = orderedItems.length
        ? Math.min(...orderedItems.map((item: any) => item.capacity))
        : 0

      return {
        is_available:
          orderedItems.length > 0 && orderedItems.every((item) => item.is_available),
        // `null` where nothing is stock-limited, rather than a fake big number.
        available_quantity: Number.isFinite(capacity) ? capacity : null,
        limited_by:
          Number.isFinite(capacity) && limiting
            ? one(limiting.product)?.title ?? null
            : null,
      }
    })(),
    calculated_bundle_price: {
      min,
      max,
      pricing_mode: bundle.pricing_mode,
      discount_percentage: bundle.discount_percentage ?? null,
    },
  }
}
