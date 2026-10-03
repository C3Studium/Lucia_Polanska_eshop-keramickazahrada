/**
 * Zakázková výroba — commissioned pieces, and the rules that follow them through checkout.
 *
 * Two different things in the admin can make a line a commission, and both count:
 *
 *  - the **Zakázková Výroba category**, which is how the catalogue is organised today; and
 *  - an enabled **production profile**, which is what drives the deposit and is set per
 *    product on the made-to-order screen.
 *
 * They do not currently overlap: the nine products in the category have no production profile,
 * so a rule written against the profile alone would never fire. Reading either keeps the
 * shipping restriction working now and still working once profiles are filled in.
 */

export const COMMISSION_CATEGORY_HANDLE = "zakazkova-vyroba"

type CartLike = {
  items?: { product?: { categories?: { handle?: string | null }[] | null } | null }[] | null
}

/** True when the line's product sits in the commission category. */
export const isCommissionLine = (item: {
  product?: { categories?: { handle?: string | null }[] | null } | null
}) =>
  (item?.product?.categories ?? []).some(
    (category) => category?.handle === COMMISSION_CATEGORY_HANDLE
  )

export const cartHasCommissionCategory = (cart: CartLike | null | undefined) =>
  (cart?.items ?? []).some(isCommissionLine)

/**
 * True when a cart/order line is a commission by ANY signal we have:
 *  - the catalogue category (`isCommissionLine`), or
 *  - the product's made-to-order marker, set by the production profile
 *    (`product.metadata.made_to_order`), or
 *  - a brief already written onto the line (`metadata.made_to_order`).
 *
 * The product marker is the one that matters in practice: a zakázka driven only by a production
 * profile has no category and, until the customer writes something, no brief — so without it the
 * checkout showed the deposit slider (which reads the profile) but never the brief box, and the
 * customer had nowhere to say what they wanted. Reads `product.metadata`, which the cart query
 * already carries via `+items.product.metadata`.
 */
export const isMadeToOrderLine = (item: {
  product?: {
    categories?: { handle?: string | null }[] | null
    metadata?: Record<string, any> | null
  } | null
  metadata?: Record<string, any> | null
}): boolean =>
  isCommissionLine(item) ||
  Boolean(item?.product?.metadata?.made_to_order) ||
  Boolean(item?.metadata?.made_to_order)

/**
 * The owner's instruction — „co mi pošlete" — shown at the top of the brief. Mirrored onto the
 * product from the production profile's `specification_prompt`, so the line carries it without a
 * second request. Empty string when she left the field blank (the brief then shows its own lede).
 */
export const commissionPrompt = (item: {
  product?: { metadata?: Record<string, any> | null } | null
}): string => {
  const prompt = item?.product?.metadata?.made_to_order_prompt
  return typeof prompt === "string" ? prompt.trim() : ""
}

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("cs")

/**
 * Whether a delivery option may carry a commission: collection in person, or the carrier
 * service that handles fragile goods. Matched on the option's name because that is what the
 * owner controls in the admin — the fragile service has no flag of its own, and a hard-coded
 * option id would break the first time she recreates it (which is exactly how the two Česká
 * pošta options ended up pointing at a provider that no longer exists).
 */
export const deliveryAllowsCommission = (
  option: { name?: string | null } | null | undefined,
  isPickup: boolean
) => isPickup || fold(option?.name ?? "").includes("krehke")
