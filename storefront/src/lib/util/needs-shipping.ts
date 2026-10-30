/**
 * Potřebuje košík dopravu?
 *
 * Rozhoduje `requires_shipping` na položce — backend ho vypne u elektronického
 * dárkového poukazu (`workflows/custom-add-to-cart.ts`) a u servisních řádků
 * (balné, doběrečné). Medusa pak košík bez zboží k odeslání dokončí i bez
 * zvolené dopravy, a pokladna krok Doručení přeskočí.
 *
 * Prázdný košík = „ano": nic se neobchází, dokud není co.
 */
export const cartNeedsShipping = (
  cart:
    | { items?: Array<{ requires_shipping?: boolean | null } | null> | null }
    | null
    | undefined
): boolean => {
  const items = (cart?.items ?? []).filter(Boolean) as Array<{
    requires_shipping?: boolean | null
  }>
  if (!items.length) return true
  return items.some((item) => item.requires_shipping !== false)
}
