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
