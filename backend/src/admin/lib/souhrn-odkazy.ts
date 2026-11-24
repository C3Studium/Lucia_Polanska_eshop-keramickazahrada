/**
 * Řádky nativní karty Souhrn ↔ položky objednávky (24. 11. 2026).
 *
 * Medusa řádky nijak neoznačuje (žádné id v DOM) a mezi položky vkládá
 * vlastní řádky vrácení a reklamací, takže pořadí nestačí. Páruje se podle
 * názvu řádku (`item.title`), v pořadí, a každá položka nejvýš jednou —
 * dvě položky se stejným názvem tak dostanou každá svůj řádek.
 */
const norm = (text: string | null | undefined) => String(text ?? "").replace(/\s+/g, " ").trim().toLowerCase()

export const parujRadky = (
  nazvyRadku: string[],
  polozky: Array<{ id: string; title?: string | null }>
): Array<string | null> => {
  const pouzite = new Set<string>()
  return nazvyRadku.map((nazev) => {
    const hledany = norm(nazev)
    const polozka = polozky.find((p) => !pouzite.has(p.id) && norm(p.title) === hledany)
    if (!polozka) return null
    pouzite.add(polozka.id)
    return polozka.id
  })
}
