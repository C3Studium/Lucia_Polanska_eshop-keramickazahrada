"use server"

/**
 * The shop's voice — vacation + announcements from the backend
 * (GET /store/shop-status, public). Cached briefly: the banner may lag a
 * minute behind the admin, never a day.
 */
export type ShopStatus = {
  vacation: { until: string | null; message: string } | null
  announcement: { message: string; link?: string | null } | null
  commissions_paused: boolean
}

export async function getShopStatus(): Promise<ShopStatus | null> {
  const base =
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
  if (!base) return null

  /*
   * Publikovatelný klíč MUSÍ jít s dotazem.
   *
   * Každá `/store/*` routa Medusy si ho vynucuje — bez hlavičky vrací 400
   * („Publishable API key required"), ne 401 ani prázdná data. Tenhle modul ji
   * dřív neposílal, takže `response.ok` bylo vždycky false, funkce vracela
   * `null` a pás oznámení se nevykreslil nikdy. Navenek to vypadalo jako
   * „dovolená není zapnutá", protože prázdný stav a selhání dotazu tu mají
   * záměrně stejný projev — a to je přesně ta záměna, kvůli které se to
   * hledalo dlouho.
   *
   * Obě jména hlavičky, stejně jako `getProductReviews`: starší verze Medusy
   * čte `x-publishable-key`, novější `x-publishable-api-key`.
   */
  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  try {
    const response = await fetch(`${base.replace(/\/+$/, "")}/store/shop-status`, {
      headers: pk
        ? { "x-publishable-api-key": pk, "x-publishable-key": pk }
        : {},
      next: { revalidate: 60 },
    })
    if (!response.ok) {
      // Nahlas. Tichý `null` je legitimní odpověď na „nic se neděje", takže
      // odmítnutý dotaz se bez tohohle řádku od prázdného stavu nepozná.
      console.error(
        `[shop-status] Backend odmítl dotaz: HTTP ${response.status}.`
      )
      return null
    }
    return (await response.json()) as ShopStatus
  } catch {
    // A missing banner must never break a page.
    return null
  }
}
