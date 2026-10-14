/**
 * Věta o dovolené — stejná v pásu nahoře i v pokladně.
 *
 * Dovolená je jen upozornění: nakupovat jde dál, zákazník se dozví, odkdy
 * se objednávky vyřizují (14. 10. 2026 — dřív pokladna zakázku odmítla
 * hláškou „Výroba na zakázku má právě přestávku").
 */

/** „2026-08-16" → „16. 8. 2026"; nečitelné → null. Bez Date, ať nehraje pásmo. */
export const czechDay = (iso: string | null | undefined): string | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso?.trim() ?? "")
  if (!match) return null
  const [, year, month, day] = match
  return `${Number(day)}. ${Number(month)}. ${year}`
}

export const vacationSentence = (
  vacation: { message: string; until: string | null } | null | undefined
): string | null => {
  if (!vacation?.message?.trim()) return null
  const day = czechDay(vacation.until)
  return `${vacation.message.trim()}${day ? ` Objednávky začnu vyřizovat ${day}.` : ""}`
}
