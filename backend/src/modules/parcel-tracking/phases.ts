/**
 * Fáze zásilky u České pošty (docs/sledovani-zasilek.md §1–2).
 *
 * Žije v modulu (ne v lib), aby model i migrace braly seznam z jednoho místa a
 * CHECK v databázi nemohl říkat něco jiného než kód. Pořadí = „jak daleko
 * zásilka došla": fáze se posouvají jen vpřed (apply.ts), `returned` a
 * `problem` stojí stranou jako výsledek / varování.
 */
export const PARCEL_PHASES = [
  "label",
  "handed_over",
  "in_transit",
  "stored",
  "delivered",
  "returned",
  "problem",
] as const

export type ParcelPhase = (typeof PARCEL_PHASES)[number]

export const isParcelPhase = (value: unknown): value is ParcelPhase =>
  typeof value === "string" && (PARCEL_PHASES as readonly string[]).includes(value)
