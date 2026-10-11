/**
 * Typ výdejního místa Balíkovny — kvůli dobírce.
 *
 * ## Proč na typu záleží (změřeno 11. 10. 2026)
 *
 * Widget Balíkovny (`b2c.cpost.cz/locations`) zná u každého místa `subtype`:
 * `POSTA` (2 917), `DEPO` (49), `PARTNER` (3 935 — Žabka, Allwyn…) a `BOX`
 * (4 731 — AlzaBox, OX Point, Balíkovna BOX). U boxu se dobírka NEPLATÍ na
 * místě: zákazník ji musí předem zaplatit kartou online přes odkaz v SMS /
 * e-mailu / aplikaci, jinak se box neotevře (ČP: manuál widgetu „Platba
 * dobírky pouze předem kartou online", blog Balíkovny o úhradě z SMS).
 *
 * Kdo volí dobírku, chce platit při převzetí. Do boxu by se zásilka vrátila
 * nevyzvednutá a majitelka by platila poštovné tam i zpátky — proto se do boxu
 * dobírka nenabízí (pokladna) a neprojde (completeCart hook, změna výdejny).
 *
 * ## Kde se typ bere
 *
 * Pokladna ho od 11. 10. 2026 ukládá do `metadata.balikovna_point_subtype`
 * (pickerResult posílá celý bod). Starší košíky/objednávky ho nemají — pak se
 * dohledá přes veřejné API widgetu `GET /locations/api/points/{id}` (id =
 * `B` + PSČ výdejny, ověřeno: `B16908` → `subtype: "BOX"`). Nedostupné API =
 * `null` (neznámý typ) a volající rozhodne — kontrola je pojistka za
 * pokladnou, ne jediná brána.
 */

const POINT_API = "https://b2c.cpost.cz/locations/api/points"
const LOOKUP_TIMEOUT_MS = 4000

/** `BOX` (AlzaBox, OX Point, Balíkovna BOX) a `BBOX` (BalíkoBOX) jsou boxy. */
export const isBalikovnaBoxSubtype = (subtype: unknown): boolean =>
  typeof subtype === "string" && /^b?box$/i.test(subtype.trim())

const str = (value: unknown): string =>
  typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()

/** Id bodu pro API widgetu: uložené id, jinak `B` + PSČ výdejny. */
export const balikovnaPointIdFrom = (
  metadata: Record<string, unknown> | null | undefined
): string | null => {
  const id = str(metadata?.balikovna_point_id)
  if (/^B\d+$/i.test(id)) {
    return id.toUpperCase()
  }
  const zip = str(metadata?.balikovna_point_zip).replace(/\s+/g, "")
  return /^\d{5}$/.test(zip) ? `B${zip}` : null
}

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal }
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

/** Podtyp bodu z API widgetu; `null` při chybě, timeoutu nebo neznámém bodu. */
export const fetchBalikovnaPointSubtype = async (
  pointId: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike
): Promise<string | null> => {
  try {
    const response = await fetchImpl(`${POINT_API}/${encodeURIComponent(pointId)}`, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    })
    if (!response.ok) {
      return null
    }
    const body = (await response.json()) as { subtype?: unknown } | null
    const subtype = str(body?.subtype)
    return subtype || null
  } catch {
    return null
  }
}

/**
 * Typ výdejny objednávky/košíku: uložený, jinak dohledaný. `null` = neznámý
 * (žádná výdejna nebo API nedostupné).
 */
export const resolveBalikovnaPointSubtype = async (
  metadata: Record<string, unknown> | null | undefined,
  fetchImpl?: FetchLike
): Promise<string | null> => {
  const stored = str(metadata?.balikovna_point_subtype)
  if (stored) {
    return stored.toUpperCase()
  }
  const pointId = balikovnaPointIdFrom(metadata)
  if (!pointId) {
    return null
  }
  const fetched = await fetchBalikovnaPointSubtype(pointId, fetchImpl)
  return fetched ? fetched.toUpperCase() : null
}

export const DOBIRKA_BOX_MESSAGE =
  "Do boxu nejde poslat zásilku na dobírku — v boxu se dobírka platí jen předem kartou online. Vyberte prosím výdejnu na poště nebo u partnera, nebo zaplaťte kartou."
