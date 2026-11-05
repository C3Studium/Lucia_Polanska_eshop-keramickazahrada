/**
 * Osobní odběr v ateliéru — zboží i peníze se potkají u pultu.
 *
 * Jedno pravidlo pro Denní práci (projekce) i zakázky: „Zaplaceno na místě"
 * dává smysl jen tady; u zásilky Českou poštou zákazník do ateliéru nepřijde
 * (14. 10. 2026).
 *
 * ## Kód služby přebíjí příznak odběru (3. 11. 2026)
 *
 * Zakázka s cenou po domluvě se objednává na osobní odběr a dopravu dostane
 * až v administraci. Medusa ale `data` metody dopravy SLUČUJE, takže po
 * výměně na Českou poštu zůstal v datech `personal_pickup: true` vedle
 * `service_code: "DR"` — objednávka na poštu, a Denní práce pořád nabízela
 * vyzvednutí u pultu (objednávka #69).
 *
 * Psát se to má správně (`lib/made-to-order/shipping-choice` teď příznak
 * dopisuje vždy), ale číst se to musí tak, aby takový rozpor nikoho
 * nepoložil: **má-li metoda kód služby dopravce, je to zásilka** — ten kód
 * zapsal dopravce, ne zbytek po dřívější volbě.
 */
const PICKUP_CODE = "PICKUP"

export const isPersonalPickupOrder = (
  order: { shipping_methods?: any[] | null } | null | undefined
): boolean =>
  (order?.shipping_methods ?? []).some((method: any) => {
    const data = method?.data || {}
    const code = String(data.service_code ?? "")
    if (code && code !== PICKUP_CODE) return false
    return data.personal_pickup === true || code === PICKUP_CODE
  })
