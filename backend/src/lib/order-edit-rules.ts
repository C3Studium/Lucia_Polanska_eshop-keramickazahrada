/**
 * Pravidla zákaznické editace objednávky (Matěj, 2026-08-07).
 *
 * Čistá funkce = testovatelná jednou provždy. Tři zákony:
 * 1. Zakázkové řádky se NEeditují (metadata.made_to_order) — volá se.
 * 2. Editace není zrušení: po akcích musí zbýt aspoň jeden kus.
 * 3. Peníze: karta+dráž = zaplatit PŘED potvrzením; karta+levněji =
 *    potvrdit a založit vratku (klikne ona); odběr/dobírka = potvrdit hned,
 *    vyrovná se při předání.
 */

export type EditAction =
  | { type: "swap"; item_id: string; variant_id: string }
  | { type: "remove"; item_id: string }
  | { type: "add"; variant_id: string; quantity: number }

export type OrderLineInfo = {
  id: string
  quantity: number
  is_made_to_order: boolean
}

export type PaymentKind = "card" | "pickup" | "dobirka"

export const validateEditActions = (
  lines: OrderLineInfo[],
  actions: EditAction[]
): { ok: true } | { ok: false; reason: string } => {
  if (!actions.length) {
    return { ok: false, reason: "Žádná změna k uložení." }
  }
  const byId = new Map(lines.map((line) => [line.id, line]))

  for (const action of actions) {
    if (action.type === "swap" || action.type === "remove") {
      const line = byId.get(action.item_id)
      if (!line) return { ok: false, reason: "Položka v objednávce není." }
      if (line.is_made_to_order) {
        return {
          ok: false,
          reason:
            "Zakázková položka se tady upravit nedá — zavolejte nám prosím, domluvíme se.",
        }
      }
    }
  }

  // Editace ≠ zrušení: spočti, co po akcích zbyde.
  const removed = new Set(
    actions
      .filter((a): a is Extract<EditAction, { type: "remove" }> => a.type === "remove")
      .map((a) => a.item_id)
  )
  const remaining =
    lines.filter((line) => !removed.has(line.id)).length +
    actions.filter((a) => a.type === "add").length
  if (remaining < 1) {
    return {
      ok: false,
      reason:
        "Objednávka nemůže zůstat prázdná — tohle je úprava, ne zrušení. Zrušení řešte s námi.",
    }
  }
  return { ok: true }
}

export type Settlement =
  | { kind: "none" }
  | { kind: "collect"; amount: number }
  | { kind: "refund_due"; amount: number }

/** Co se stane s penězi při daném rozdílu a způsobu platby. */
export const decideSettlement = (
  difference: number,
  payment: PaymentKind
): Settlement => {
  const rounded = Math.round(difference * 100) / 100
  if (payment !== "card" || Math.abs(rounded) <= 0.005) {
    // Odběr i dobírka se vyrovnají při předání — nic se neposílá.
    return { kind: "none" }
  }
  return rounded > 0
    ? { kind: "collect", amount: rounded }
    : { kind: "refund_due", amount: -rounded }
}
