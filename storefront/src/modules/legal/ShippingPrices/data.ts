import "server-only"

/**
 * Ceník dopravy z backendu (`GET /store/legal/shipping-prices`) — tytéž
 * možnosti a ceny, jaké nabídne pokladna. Tvar odpovídá
 * `backend/src/api/store/legal/shipping-prices/prices.ts`.
 */

export type ShippingPriceTier = {
  amount: number
  operator: "gt" | "gte" | "lt" | "lte" | "eq"
  value: number
}

export type ShippingPriceOption = {
  id: string
  name: string
  type: "pickup" | "shipping"
  price_type: "flat" | "calculated"
  amount: number | null
  free_from: number | null
  tiers: ShippingPriceTier[]
}

export type ShippingPriceCountry = {
  country_code: string
  currency_code: string
  region_id: string
  options: ShippingPriceOption[]
}

export type ShippingPriceList = {
  countries: ShippingPriceCountry[]
  dobirka_fee_czk: number | null
  generated_at: string
}

/** `null` = backend nedostupný nebo odpověď nedává smysl — stránka ukáže zálohu. */
export async function getShippingPriceList(): Promise<ShippingPriceList | null> {
  const base =
    process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
  if (!base) return null

  // Každá `/store/*` routa Medusy vyžaduje publikovatelný klíč (viz
  // lib/data/shop-status.ts — bez něj 400 a tichý prázdný stav).
  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  try {
    const response = await fetch(
      `${base.replace(/\/+$/, "")}/store/legal/shipping-prices`,
      {
        headers: pk ? { "x-publishable-api-key": pk, "x-publishable-key": pk } : {},
        // Ceny mění majitelka v adminu zřídka; pět minut zpoždění je v pořádku,
        // pokladna počítá vždy živě.
        next: { revalidate: 300 },
      }
    )
    if (!response.ok) {
      console.error(`[shipping-prices] Backend odmítl dotaz: HTTP ${response.status}.`)
      return null
    }
    const data = (await response.json()) as ShippingPriceList
    return Array.isArray(data?.countries) ? data : null
  } catch {
    return null
  }
}
