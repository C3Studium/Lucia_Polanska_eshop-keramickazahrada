/**
 * Cena dopravy podle velikosti zásilky a křehkosti (16. 11. 2026, Matěj).
 *
 * Každý výrobek má třídu zásilky (`product.metadata.shipping_class`):
 * `male` / `velke` / `poukaz`. Cena dopravce se skládá:
 *
 *   základ (malá / velká zásilka; čisté poukazy svou cenou)
 *   + příplatek za křehké, když je v balíku cokoli křehkého
 *
 * Doběrečné je zvlášť — řádek objednávky (`lib/dobirka-fee`), sem nepatří.
 *
 * ## Proč razítko na řádku košíku
 *
 * Výpočet ceny běží v poskytovateli dopravy (modul fulfillment), který do
 * produktů nevidí: Medusa mu předá řádky košíku (`items.*`, tedy i jejich
 * metadata), ne metadata produktů. Srovnání košíku (`lib/packaging.ts`)
 * proto na každý řádek výrobku otiskne `ship_class` a `ship_fragile` —
 * a výpočet čte jen tohle. Ceny drží data volby dopravy (`data.rates`),
 * zapisuje je stránka Nastavení obchodu › Doprava a platba.
 */

import { isGiftVoucherProduct } from "./voucher"

export type ShippingClass = "male" | "velke" | "poukaz"

export const SHIPPING_CLASSES: ShippingClass[] = ["male", "velke", "poukaz"]

export type ShippingRates = {
  /** Malá zásilka. */
  small: number
  /** Velká zásilka — stačí jediný velký kus. */
  large: number
  /** Příplatek za křehké; `null`/chybí = dopravce křehké neveze. */
  fragile?: number | null
  /** Zásilka jen s (tištěnými) poukazy; chybí = malá cena. */
  poukaz?: number | null
}

/** Skupina cen: Česká pošta (Balík Do ruky) nebo Balíkovna (výdejna i na adresu). */
export type RateGroup = "posta" | "balikovna"

/** Výchozí ceny, než je majitelka nastaví — vychází z dosavadních pevných cen. */
export const DEFAULT_RATES: Record<RateGroup, ShippingRates> = {
  posta: { small: 90, large: 130, fragile: 60, poukaz: 90 },
  balikovna: { small: 60, large: 90, fragile: 60, poukaz: 60 },
}

/* Stejné poznání poukazu jako všude jinde (i poukaz s vlastní částkou). */
const isVoucherMeta = (meta: Record<string, unknown>) => isGiftVoucherProduct(meta)

/** Třída zásilky výrobku; bez uložené hodnoty poukaz u dárkového poukazu, jinak malé. */
export const shippingClassOf = (
  metadata: Record<string, unknown> | null | undefined
): ShippingClass => {
  const meta = metadata ?? {}
  const stored = String(meta.shipping_class ?? "")
  if ((SHIPPING_CLASSES as string[]).includes(stored)) return stored as ShippingClass
  return isVoucherMeta(meta) ? "poukaz" : "male"
}

type LineLike = {
  quantity?: unknown
  requires_shipping?: boolean | null
  metadata?: Record<string, unknown> | null
}

/** Balné a doběrečné nejsou zboží v balíku. */
const isServiceLine = (line: LineLike) => {
  const meta = line?.metadata ?? {}
  return Boolean(meta.packaging_fee) || Boolean(meta.dobirka_fee)
}

const money = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** Kolik stojí doprava zásilky s těmito řádky (Kč, celé haléře). */
export const shipmentPrice = (rates: ShippingRates, lines: LineLike[]): number => {
  const small = money(rates.small, 0)
  const large = money(rates.large, small)
  const goods = (lines ?? []).filter(
    (line) => !isServiceLine(line) && line?.requires_shipping !== false
  )
  const classes = goods.map((line) => {
    const stamped = String(line?.metadata?.ship_class ?? "")
    return (SHIPPING_CLASSES as string[]).includes(stamped) ? stamped : "male"
  })

  let base = small
  if (classes.length && classes.every((cls) => cls === "poukaz")) {
    base = money(rates.poukaz, small)
  } else if (classes.includes("velke")) {
    base = large
  }

  const fragile = goods.some((line) => line?.metadata?.ship_fragile === true)
  const surcharge = fragile ? money(rates.fragile, 0) : 0
  return Math.round((base + surcharge) * 100) / 100
}

/** Skupina cen volby dopravy podle jejích dat. */
export const rateGroupOf = (optionData: Record<string, unknown> | null | undefined): RateGroup => {
  const data = optionData ?? {}
  if (data.rate_group === "posta" || data.rate_group === "balikovna") return data.rate_group
  const id = String(data.id ?? "")
  return id.startsWith("balikovna") || String(data.service_code ?? "") === "NB" ? "balikovna" : "posta"
}

/** Výdejní místo / BOX Balíkovny — křehké sem nesmí (jen na adresu). */
export const isBalikovnaPickupOption = (optionData: Record<string, unknown> | null | undefined) =>
  String((optionData ?? {}).id ?? "") === "balikovna"

const foldName = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

/**
 * Metoda/volba dopravy = Balíkovna do VÝDEJNÍHO MÍSTA (vč. BOXu).
 *
 * Od 16. 11. 2026 existuje i „Balíkovna na adresu" — ta má doručovací adresu
 * zákazníka, ne výdejnu. Všechno, co se dřív ptalo „je to Balíkovna?" kvůli
 * výdejně (přepis dodací adresy na výdejnu, povinná výdejna u štítku, žádná
 * dobírka), se teď ptá tady. Podle id volby; u staré metody bez id podle
 * názvu, ale „na adresu" se nepočítá.
 */
export const isBalikovnaPickupMethod = (
  method: { name?: string | null; data?: Record<string, unknown> | null } | null | undefined
): boolean => {
  const id = String(method?.data?.id ?? "")
  if (id === "balikovna") return true
  if (id === "balikovna-address") return false
  const name = foldName(method?.name)
  return name.includes("balikovna") && !name.includes("adres")
}
