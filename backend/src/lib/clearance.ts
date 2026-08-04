/**
 * Výprodej — damaged and one-off pieces (requested 2026-08-04).
 *
 * ## The problem this solves
 *
 * A damaged piece is sold once and never remade. That makes it unlike every
 * other product in the shop: when it sells out there is nothing to restock, so
 * leaving it published means a listing that can never be bought, and leaving it
 * in a sale means a discount advertising something that does not exist. Both
 * are small lies that accumulate.
 *
 * ## How a product is marked
 *
 * `product.metadata.clearance === true`, set by the toggle on the product page.
 * Metadata rather than a column because it is a per-product fact that Medusa
 * already stores natively, and inventing a table for one boolean would be the
 * kind of custom state the plan spends its whole §2 arguing against.
 *
 * A native **product type** („Výprodej") is the right *filing* mechanism and she
 * can create one whenever she likes — it makes the products findable in the
 * native list. It is deliberately not what drives the behaviour, because a type
 * is renameable and a behaviour keyed to a name breaks the day somebody edits
 * it.
 */

export const CLEARANCE_METADATA_KEY = "clearance"

export const isClearanceProduct = (product: any): boolean =>
  (product?.metadata as Record<string, unknown> | null)?.[
    CLEARANCE_METADATA_KEY
  ] === true

/**
 * Whether a clearance product has run out for good.
 *
 * Availability, not stock on the shelf: pieces reserved for orders already paid
 * for are spoken for. A piece with one reserved and none free is sold — waiting
 * for the reservation to resolve would leave it advertised for another day.
 */
export const isSoldOut = (variants: any[]): boolean => {
  const tracked = (variants || []).filter((variant) => variant?.manage_inventory)

  // A clearance piece that does not track stock cannot be known to be sold out,
  // so it is left alone rather than guessed at.
  if (!tracked.length) {
    return false
  }

  return tracked.every((variant) => {
    const levels = (variant.inventory || []).flatMap(
      (item: any) => item?.location_levels || []
    )
    const available = levels.reduce(
      (total: number, level: any) =>
        total +
        (Number(level?.stocked_quantity ?? 0) -
          Number(level?.reserved_quantity ?? 0)),
      0
    )
    return available <= 0
  })
}
