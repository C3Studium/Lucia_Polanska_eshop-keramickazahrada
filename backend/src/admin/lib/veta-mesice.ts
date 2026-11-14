/**
 * Statistiky jednou větou (14. 11. 2026): „Tento měsíc 12 objednávek za
 * 18 400 Kč — o 3 víc než minulý měsíc." Grafy a čísla pod tím zůstávají;
 * věta je to, co si majitelka přečte, i když na grafy nemá čas.
 *
 * `mesice` jsou seřazené od nejstaršího, poslední je tento měsíc
 * (api/admin/workbench/orders/statistics).
 */
const objednavek = (n: number) =>
  n === 1 ? "objednávka" : n >= 2 && n <= 4 ? "objednávky" : "objednávek"

export const vetaMesice = (
  mesice: Array<{ orders: number; revenue: number }>,
  castka: (n: number) => string
): string | null => {
  if (!mesice.length) return null
  const ted = mesice[mesice.length - 1]
  const minule = mesice.length > 1 ? mesice[mesice.length - 2] : null

  if (!ted.orders) {
    return `Tento měsíc zatím žádná objednávka${minule ? ` (minulý měsíc ${minule.orders})` : ""}.`
  }
  const zaklad = `Tento měsíc ${ted.orders} ${objednavek(ted.orders)} za ${castka(ted.revenue)}`
  if (!minule) return `${zaklad}.`
  const rozdil = ted.orders - minule.orders
  if (rozdil === 0) return `${zaklad} — stejně jako minulý měsíc.`
  return `${zaklad} — o ${Math.abs(rozdil)} ${rozdil > 0 ? "víc" : "méně"} než minulý měsíc.`
}
