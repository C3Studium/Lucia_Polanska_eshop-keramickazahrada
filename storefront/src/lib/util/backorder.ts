/**
 * Backorder note — „jak dlouho trvá kousek vyrobit" (2026-08-16).
 *
 * When a variant allows backorder, a sold-out piece keeps selling and the
 * availability vocabulary says „Na objednávku". That label alone answers
 * *whether* the customer can buy, not *when* they will get it — this note is
 * the merchant's own sentence about the wait („Vyrobíme do tří týdnů."),
 * written per product in the admin and stored on the product like the other
 * shop flags (fragile, cod_allowed).
 *
 * Same convention as `fragile.ts` / `dobirka.ts`: a pure reader with a type
 * guard, so a missing or malformed value renders nothing instead of garbage.
 */
export const backorderNote = (
  product?: { metadata?: Record<string, unknown> | null } | null
): string | null => {
  const value = product?.metadata?.backorder_note
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}
