/**
 * Český název země podle ISO kódu („cz" → „Česko").
 *
 * Medusa vrací `display_name` anglicky („Czech Republic"), a ten se v pokladně
 * zobrazoval u „Země doručení" (10. 11. 2026). Obchod je česky, tak se název bere
 * z `Intl.DisplayNames`; kdyby ho prohlížeč neuměl, zůstane název z backendu.
 */
export function countryNameCs(iso2: string, fallback?: string | null): string {
  try {
    const name = new Intl.DisplayNames(["cs"], { type: "region" }).of(iso2.toUpperCase())
    if (name && name.toUpperCase() !== iso2.toUpperCase()) return name
  } catch {
    // starší prohlížeč bez Intl.DisplayNames
  }
  return fallback || iso2.toUpperCase()
}
