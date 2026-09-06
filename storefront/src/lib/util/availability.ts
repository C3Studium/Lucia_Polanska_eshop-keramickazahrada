import { HttpTypes } from "@medusajs/types"

/**
 * One availability vocabulary for the whole storefront (spec §12).
 *
 * Before this, one screen could contradict itself three ways: the badge said "K dispozici" or
 * "Na dotaz", the CTA note said "Není skladem", and the button said "Přidat do košíku". These
 * four states are the only ones a customer sees, on cards, on the product page and under the
 * add-to-cart button alike.
 */
export type Availability =
  | "in-stock" // Skladem
  | "last-one" // Poslední kus
  | "sold-out" // Prodáno
  | "made-to-order" // Na objednávku

export const availabilityLabel: Record<Availability, string> = {
  "in-stock": "Skladem",
  "last-one": "Poslední kus",
  "sold-out": "Prodáno",
  "made-to-order": "Na objednávku",
}

export const isPurchasable = (availability: Availability) =>
  availability !== "sold-out"

/** A variant's state. Untracked inventory means made-to-order, not "out of stock". */
export function variantAvailability(
  variant?: HttpTypes.StoreProductVariant | null
): Availability {
  if (!variant) {
    return "sold-out"
  }

  if (!variant.manage_inventory) {
    // The shop does not count these — they are made or finished to order.
    return "made-to-order"
  }

  const quantity = variant.inventory_quantity ?? 0

  if (quantity <= 0) {
    // Backorder means the sale continues past the last piece: sold out turns
    // into "made to order" instead of a dead end. While pieces ARE on the
    // shelf the customer sees the ordinary stock states — a piece being
    // backorderable is not information until the shelf is empty.
    return variant.allow_backorder ? "made-to-order" : "sold-out"
  }
  if (quantity === 1) return "last-one"

  return "in-stock"
}

/** A product's state, as shown on a card: the best any of its variants can offer. */
export function productAvailability(
  product?: Pick<HttpTypes.StoreProduct, "variants"> | null
): Availability {
  const variants = product?.variants ?? []

  if (!variants.length) {
    return "made-to-order"
  }

  const states = variants.map(variantAvailability)
  const rank: Availability[] = ["in-stock", "last-one", "made-to-order", "sold-out"]

  return rank.find((state) => states.includes(state)) ?? "sold-out"
}

/** How many of a variant a customer may actually put in the cart. */
export function maxPurchasableQuantity(
  variant?: HttpTypes.StoreProductVariant | null,
  fallback = 10
) {
  if (!variant) return 0
  if (variant.allow_backorder || !variant.manage_inventory) return fallback

  /*
   * `undefined` znamená „nevíme", ne „nic".
   *
   * `inventory_quantity` je počítané pole a obchodní API ho vrací jen
   * u produktů — u položek košíku nikdy, ať se v `fields` napíše cokoli
   * (ověřeno na živém backendu třemi různými zápisy). Dřív se tady
   * chybějící hodnota brala jako nula, takže ovladač množství v košíku
   * i v panelu měl strop 0 a plus se nedal zmáčknout vůbec — u kusu,
   * kterého je skladem dvacet, stejně jako u posledního.
   *
   * Když zásobu neznáme, platí strop volajícího a o skutečnou hranici se
   * postará backend; „Tolik kusů už bohužel nemáme" má svůj překlad.
   * Vyprodaný kus se tím neprodá: tam přijde skutečná nula, ne `undefined`.
   */
  if (variant.inventory_quantity == null) return fallback

  return Math.max(0, variant.inventory_quantity)
}
