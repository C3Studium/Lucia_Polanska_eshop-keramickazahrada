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

import { TEXTY_DEFAULTS } from "@lib/constants/texty"

/**
 * The shop's standard wait, said in the shop's voice.
 *
 * Phrased to be true of both kinds of „Na objednávku" the storefront shows — a
 * backordered piece that has run out, and an untracked one the atelier makes on
 * demand — because a customer cannot tell those apart and should not have to.
 *
 * Od 9. 11. 2026 si ji majitelka mění v administraci (Právní věci a texty →
 * Texty obchodu). Tohle je jen výchozí znění — kdo kreslí, bere větu
 * z `useTexty()`, aby se změna projevila bez nasazení.
 */
export const DEFAULT_BACKORDER_NOTE = TEXTY_DEFAULTS["produkt.cekani"]

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

/*
 * Dvě věty tady dřív stály navíc — pro zakázku a pro balíček, ve kterém něco
 * chybí. Obě byly mrtvé: nikdo je nevykresloval. Zjistilo se to 9. 11. 2026
 * při skládání katalogu textů, a smazaly se právě proto, aby se v administraci
 * neobjevilo políčko, které nic nemění. Zakázka o lhůtě mluví vlastním blokem
 * („Jak zakázka probíhá"), balíček větou běžnou.
 */

/**
 * What the customer actually reads under „Na objednávku".
 *
 * Never null: a piece that can be bought but not shipped from a shelf always
 * owes the customer a timeframe.
 *
 * Pořadí je od nejkonkrétnějšího: věta napsaná u tohohle kusu, pak společná
 * věta z administrace, a teprve když se texty nedají načíst, výchozí znění
 * z kódu. Vlastní věta u produktu má přednost schválně — je o něm, ne o celém
 * obchodě.
 */
export const backorderWaitNote = (
  product?: { metadata?: Record<string, unknown> | null } | null,
  spolecna?: string | null
): string => {
  const vlastni = backorderNote(product)
  if (vlastni) return vlastni
  /* `undefined` = volající texty nemá (starší volání) → výchozí znění.
     `""` = majitelka větu vypnula nebo smazala → nic. Ten rozdíl je tu
     podstatný: jinak by vypnutá věta vracela výchozí a vypínač by nefungoval. */
  if (spolecna === undefined) return DEFAULT_BACKORDER_NOTE
  return spolecna?.trim() ?? ""
}
