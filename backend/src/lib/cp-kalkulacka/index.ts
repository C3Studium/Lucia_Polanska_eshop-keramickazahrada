import { CP_COUNTRIES, CP_FETCHED_AT, CP_SERVICES } from "./data"

/**
 * Kalkulačka České pošty do zahraničí (19. 11. 2026) — ČISTÁ, bez Medusy.
 *
 * B2B API ČP (nAPI) cenu nevrací vůbec; ceny má jen veřejná kalkulačka
 * postaonline.cz/kalkulacka-postovneho. Její odpovědi jsou stažené do
 * `data.ts` (každá země × služba × váhový stupeň 0,5 kg a po kilech do
 * 20/30 kg, cena s DPH v Kč, balík bez pojištění a doplňkových služeb).
 * V pokladně se kalkulačka ŽIVĚ nevolá — je to neveřejné rozhraní za
 * ochranou proti botům. Obnova ceníku: docs/cp-kalkulacka/PLAN.md §5.
 *
 * Cena = první stupeň, jehož „do kg" hmotnost pokryje (2,6 kg → „do 3 kg"),
 * stejně jako na postaonline.cz.
 */

export const CP_SERVICE_DEFAULT = "Standardní balík do zahraničí - prioritní"

/** Náhradní služby, když zvolená do země nejede nebo nebere takovou váhu. */
export const CP_FALLBACK_ORDER = [
  "Standardní balík do zahraničí - prioritní",
  "Standardní balík do zahraničí - ekonomický",
  "Obchodní balík do zahraničí",
  "EMS do zahraničí",
]

export const cpFetchedAt = (): string => CP_FETCHED_AT

/** Služby, které v ceníku opravdu jsou. */
export const cpServices = (): string[] => [...CP_SERVICES]

/** Český název země podle ČP, nebo kód. */
export const cpCountryName = (country: string): string =>
  CP_COUNTRIES[String(country).toLowerCase()]?.n ?? String(country).toUpperCase()

/** Stupně služby pro zemi: [[do kg, cena s DPH v Kč], …] vzestupně. */
export const cpTiers = (country: string, service: string): Array<[number, number]> => {
  const index = CP_SERVICES.indexOf(service)
  if (index < 0) return []
  return CP_COUNTRIES[String(country).toLowerCase()]?.s?.[String(index)] ?? []
}

/** Jezdí ČP do země s balíkem vůbec (jakoukoli službou)? */
export const cpShipsTo = (country: string): boolean =>
  Object.keys(CP_COUNTRIES[String(country).toLowerCase()]?.s ?? {}).length > 0

/** Nejvyšší váha služby do země (kg), 0 = nejede. */
export const cpMaxKg = (country: string, service: string): number => {
  const tiers = cpTiers(country, service)
  return tiers.length ? tiers[tiers.length - 1][0] : 0
}

const validKg = (kg: number) => Number.isFinite(kg) && kg > 0

/** Cena s DPH v Kč pro službu a hmotnost, nebo `null` (tam/tak nejede). */
export const cpPriceCzk = (country: string, service: string, weightKg: number): number | null => {
  if (!validKg(weightKg)) return null
  const tier = cpTiers(country, service).find(([upTo]) => upTo + 1e-9 >= weightKg)
  return tier ? tier[1] : null
}

export type CpQuote = {
  price_czk: number
  /** Služba, která se opravdu použila (může být náhradní). */
  service: string
  /** Stupeň ceníku („do X kg"). */
  up_to_kg: number
  /** Nastoupila náhradní služba? */
  fallback: boolean
}

/** Cena do země: zvolená služba, a když nejde, první náhradní (CP_FALLBACK_ORDER). */
export const cpQuote = (country: string, service: string, weightKg: number): CpQuote | null => {
  if (!validKg(weightKg)) return null
  const order = [service, ...CP_FALLBACK_ORDER.filter((name) => name !== service)]
  for (const name of order) {
    const tier = cpTiers(country, name).find(([upTo]) => upTo + 1e-9 >= weightKg)
    if (tier) return { price_czk: tier[1], service: name, up_to_kg: tier[0], fallback: name !== service }
  }
  return null
}

/** Všechny služby do země pro jednu váhu — „malá kalkulačka" v administraci. */
export const cpAllQuotes = (
  country: string,
  weightKg: number
): Array<{ service: string; price_czk: number | null; up_to_kg: number | null; max_kg: number }> =>
  CP_SERVICES.map((service) => {
    const tier = validKg(weightKg)
      ? cpTiers(country, service).find(([upTo]) => upTo + 1e-9 >= weightKg)
      : undefined
    return {
      service,
      price_czk: tier ? tier[1] : null,
      up_to_kg: tier ? tier[0] : null,
      max_kg: cpMaxKg(country, service),
    }
  })
