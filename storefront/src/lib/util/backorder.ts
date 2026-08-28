/**
 * Backorder note — „jak dlouho trvá kousek vyrobit" (2026-08-16).
 *
 * When a variant allows backorder, a sold-out piece keeps selling and the
 * availability vocabulary says „Na objednávku". That label alone answers
 * *whether* the customer can buy, not *when* they will get it — and „Na
 * objednávku" with no date attached is the kind of silence a customer fills in
 * with the worst guess, then abandons the cart over.
 *
 * So there is always a sentence about the wait: the merchant's own if she wrote
 * one on the product, the shop's standard promise otherwise.
 *
 * Same convention as `fragile.ts` / `dobirka.ts`: a pure reader with a type
 * guard, so a missing or malformed value renders the default instead of garbage.
 */

/**
 * The shop's standard wait, said in the shop's voice.
 *
 * Phrased to be true of both kinds of „Na objednávku" the storefront shows — a
 * backordered piece that has run out, and an untracked one the atelier makes on
 * demand — because a customer cannot tell those apart and should not have to.
 */
export const DEFAULT_BACKORDER_NOTE =
  "Tenhle kousek nemáme skladem — vyrobíme ho pro vás. Obvykle to trvá 3–7 dní."

/** The merchant's own sentence, when she wrote one on the product. */
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

/**
 * What the customer actually reads under „Na objednávku".
 *
 * Never null: a piece that can be bought but not shipped from a shelf always
 * owes the customer a timeframe.
 */
export const backorderWaitNote = (
  product?: { metadata?: Record<string, unknown> | null } | null
): string => backorderNote(product) ?? DEFAULT_BACKORDER_NOTE
