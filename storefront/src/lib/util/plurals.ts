/**
 * Czech has three plural forms: 1 / 2–4 / 5+. Getting it wrong reads as machine translation,
 * which is precisely the impression a hand-made atelier cannot afford.
 *
 *   pluralize(1, "výrobek", "výrobky", "výrobků")  → "výrobek"
 *   pluralize(3, …)                                → "výrobky"
 *   pluralize(7, …)                                → "výrobků"
 */
export function pluralize(
  count: number,
  one: string,
  few: string,
  many: string
) {
  const n = Math.abs(Math.trunc(count))

  if (n === 1) return one
  if (n >= 2 && n <= 4) return few

  return many
}

/** The count and its noun together, e.g. "3 recenze". */
export const withCount = (
  count: number,
  one: string,
  few: string,
  many: string
) => `${count} ${pluralize(count, one, few, many)}`

export const vyrobek = (count: number) =>
  pluralize(count, "výrobek", "výrobky", "výrobků")

export const kus = (count: number) => pluralize(count, "kus", "kusy", "kusů")

export const recenze = (count: number) =>
  pluralize(count, "recenze", "recenze", "recenzí")
