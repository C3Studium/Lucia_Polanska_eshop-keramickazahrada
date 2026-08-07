/**
 * Whether an order travelled by carrier, or was collected in person.
 *
 * The distinction matters wherever the customer is told about transport damage: Osobní odběr
 * has no courier to inspect a parcel in front of and no carrier to claim against, so the
 * warning would be noise there — and noise is how a warning stops being read on the orders
 * where it counts.
 *
 * Matched on the shipping method's name because that is what the owner controls in the admin.
 * Anything that is not collection is treated as carriage, which is the safe way round: a new
 * courier she adds tomorrow gets the warning by default rather than silently losing it.
 */

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("cs")

type OrderLike = {
  shipping_methods?: { name?: string | null }[] | null
}

export const isCarrierShippingMethod = (order: OrderLike | null | undefined) => {
  const methods = order?.shipping_methods ?? []
  if (!methods.length) return false

  return methods.some((method) => {
    const name = fold(method?.name ?? "")
    return !name.includes("osobni odber") && !name.includes("vyzvednuti")
  })
}
