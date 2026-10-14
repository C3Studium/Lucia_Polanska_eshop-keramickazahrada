"use server"

/**
 * Nejnižší cena za 30 dní před slevou (§ 12a ZOS) z backendu
 * (`GET /store/price-history/reference`, veřejná store routa).
 *
 * Volá ji klientský hook `usePriceReference` (stránka výrobku i karta
 * v obchodě) jako server action — všechny zlevněné varianty jedné stránky
 * jedním dotazem. Odpověď se drží v datové cache Nextu: referenční cena se
 * mění nejvýš jednou za den, nová sleva má nové id varianty v dotazu, takže
 * hodina zpoždění nikoho nezmýlí.
 *
 * Selhání vrací `null` — storefront pak u slevy neukáže procento ani
 * přeškrtnutou cenu, jen aktuální cenu se štítkem „Sleva" (nikdy cenu, která
 * by mohla klamat).
 */

export type PriceReference = {
  lowest_30d: number | null
  sale_started_on: string | null
  /** Historie pokrývá celých 30 dní před slevou. */
  complete: boolean
}

const MAX_IDS = 100
const REVALIDATE_SECONDS = 3600

export async function getPriceReferences(
  variantIds: string[],
  currencyCode: string
): Promise<Record<string, PriceReference> | null> {
  const base =
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
  if (!base) return null

  const ids = Array.from(
    new Set((variantIds ?? []).filter((id) => typeof id === "string" && id))
  )
    // Seřazené, ať stejná sada variant trefí stejný záznam v cache.
    .sort()
    .slice(0, MAX_IDS)
  const currency = String(currencyCode || "czk").toLowerCase()
  if (!ids.length) return {}

  // Publikovatelný klíč je u /store/* povinný (viz `shop-status.ts`).
  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  const url = new URL(`${base.replace(/\/+$/, "")}/store/price-history/reference`)
  url.searchParams.set("variant_ids", ids.join(","))
  url.searchParams.set("currency_code", currency)

  try {
    const response = await fetch(url, {
      headers: pk
        ? { "x-publishable-api-key": pk, "x-publishable-key": pk }
        : {},
      cache: "force-cache",
      next: { revalidate: REVALIDATE_SECONDS, tags: ["price-history"] },
    })
    if (!response.ok) {
      console.error(
        `[price-history] Backend odmítl dotaz: HTTP ${response.status}.`
      )
      return null
    }
    const payload = (await response.json()) as {
      references?: Record<string, PriceReference>
    }
    return payload?.references ?? {}
  } catch {
    return null
  }
}
