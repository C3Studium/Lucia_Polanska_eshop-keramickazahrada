/**
 * Veřejný JSON sledování České pošty (docs/sledovani-zasilek.md §1).
 *
 * `GET https://b2c.cpost.cz/services/ParcelHistory/getDataAsJson?idParcel=…`
 * — bez autentizace, odpověď je pole zásilek, každá se `states.state[]`.
 * Neznámé číslo nevrací chybu, ale jeden stav `-3` („není v evidenci"), takže
 * HTTP 200 ještě neznamená, že ČP zásilku zná — to řeší klasifikace.
 *
 * Parser je schválně tolerantní: ČP JSON vzniká konverzí z XML, kde se
 * jednoprvkové pole občas objeví jako objekt, a chybějící pole jako `null`.
 * Raději dvě větve navíc než sledování, které spadne na tvaru odpovědi.
 */

export const CP_TRACKING_API =
  "https://b2c.cpost.cz/services/ParcelHistory/getDataAsJson"

/** Dohoda z kontraktu: identifikujeme se, voláme nejvýš 1× za 30 min na zásilku. */
export const CP_USER_AGENT = "KeramickaZahrada/1.0"

export const CP_TIMEOUT_MS = 10_000

export type ParcelEventInput = {
  id: string
  text: string
  /** `YYYY-MM-DD` — ČP dává jen datum, pořadí v poli je chronologie. */
  date: string
  postoffice?: string | null
  postcode?: string | null
}

const str = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value)

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value]

/** Čistý parser — testovatelný bez sítě. */
export const parseParcelHistory = (payload: unknown): ParcelEventInput[] => {
  const parcels = asArray(payload)
  const events: ParcelEventInput[] = []

  for (const parcel of parcels) {
    const states = (parcel as any)?.states
    const list = asArray(states?.state ?? states)
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue
      const id = str((raw as any).id).trim()
      const text = str((raw as any).text).trim()
      if (!id && !text) continue
      events.push({
        id,
        text,
        date: str((raw as any).date).slice(0, 10),
        postoffice: str((raw as any).postoffice) || null,
        postcode: str((raw as any).postcode) || null,
      })
    }
  }

  return events
}

export class ParcelHistoryError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = "ParcelHistoryError"
  }
}

type FetchLike = (input: string, init?: Record<string, unknown>) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

/**
 * Jeden dotaz na historii zásilky. Chyba sítě / timeout / ne-JSON vyhodí
 * `ParcelHistoryError` — volající (job, route) ji loguje a zkusí to příště;
 * nikdy se z ní nesmí stát „zásilka se neobjevila".
 */
export const fetchParcelHistory = async (
  parcelCode: string,
  options: { timeoutMs?: number; fetchImpl?: FetchLike } = {}
): Promise<ParcelEventInput[]> => {
  const code = parcelCode.trim()
  if (!code) {
    throw new ParcelHistoryError("Chybí číslo zásilky.")
  }

  const fetchImpl: FetchLike =
    options.fetchImpl ?? ((globalThis as any).fetch as FetchLike)
  if (!fetchImpl) {
    throw new ParcelHistoryError("fetch není k dispozici.")
  }

  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? CP_TIMEOUT_MS
  )

  try {
    const response = await fetchImpl(
      `${CP_TRACKING_API}?idParcel=${encodeURIComponent(code)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": CP_USER_AGENT,
        },
        signal: controller.signal,
      }
    )
    if (!response.ok) {
      throw new ParcelHistoryError(
        `ČP sledování odpovědělo HTTP ${response.status}.`,
        response.status
      )
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new ParcelHistoryError("ČP sledování nevrátilo platný JSON.")
    }
    return parseParcelHistory(payload)
  } catch (error) {
    if (error instanceof ParcelHistoryError) {
      throw error
    }
    const aborted = (error as any)?.name === "AbortError"
    throw new ParcelHistoryError(
      aborted
        ? "ČP sledování neodpovědělo do 10 s."
        : `ČP sledování: ${(error as Error)?.message ?? String(error)}`
    )
  } finally {
    clearTimeout(timer)
  }
}
