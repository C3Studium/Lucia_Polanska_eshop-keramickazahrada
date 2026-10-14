/**
 * Osobní odběr v ateliéru — zboží i peníze se potkají u pultu.
 *
 * Jedno pravidlo pro Denní práci (projekce) i zakázky: „Zaplaceno na místě"
 * dává smysl jen tady; u zásilky Českou poštou zákazník do ateliéru nepřijde
 * (14. 10. 2026).
 */
export const isPersonalPickupOrder = (
  order: { shipping_methods?: any[] | null } | null | undefined
): boolean =>
  (order?.shipping_methods ?? []).some((method: any) => {
    const data = method?.data || {}
    return data.personal_pickup === true || data.service_code === "PICKUP"
  })
