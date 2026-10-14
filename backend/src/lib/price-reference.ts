/**
 * § 12a zákona o ochraně spotřebitele — „nejnižší cena za 30 dní před slevou".
 *
 * Čistá část: žádný container, žádná databáze. Job `record-price-history`
 * sem nasype pozorované ceny a dostane, co zapsat; store routa
 * `price-history/reference` sem nasype historii a dostane referenční cenu.
 * Celé pravidlo se tak dokazuje v unit testu (`__tests__/price-reference`).
 *
 * ## Pravidlo
 *
 * 1. **Začátek slevy.** Den, kdy začal souvislý běh dní se zaznamenanou akční
 *    cenou, který trvá dodnes. Dny bez jakéhokoli záznamu (job neběžel,
 *    výrobek nebyl zveřejněný) běh nepřeruší, pokud jich za sebou není víc
 *    než `MAX_UNRECORDED_GAP_DAYS`; přeruší ho den, kdy job běžel a slevu
 *    neviděl. Navazující slevy (jeden price-list skončí, druhý hned začne)
 *    jsou jeden běh — jako „předchozí cena" se bere cena před PRVNÍ slevou
 *    (čl. 6a odst. 5 směrnice 98/6/ES).
 *    - Sleva, kterou historie ještě nezachytila (začala dnes po posledním
 *      běhu jobu), začíná dnes.
 *    - Začíná-li běh prvním zaznamenaným dnem vůbec (historie začala uprostřed
 *      slevy), skutečný začátek neznáme; vezme se `starts_at` price-listu,
 *      pokud je dřívější.
 * 2. **Okno** je 30 kalendářních dní před začátkem slevy (den začátku už ne).
 * 3. **Nejnižší cena** = minimum všech zaznamenaných cen v okně, běžných
 *    i akčních (předchozí sleva v okně se počítá).
 * 4. **Úplnost.** `complete: true` jen tehdy, když historie sahá aspoň
 *    k začátku okna a v okně je aspoň jeden záznam. Jinak (typicky prvních
 *    30 dní po nasazení) se mezi kandidáty přidá i dnešní běžná cena
 *    a výsledek je `complete: false` — storefront pak neříká „za 30 dní",
 *    ale jen „nejnižší cena před slevou", což je pravda.
 */

export type PriceKind = "base" | "sale"

export type PriceHistoryPoint = {
  /** `YYYY-MM-DD`, Europe/Prague. */
  recorded_on: string
  kind: PriceKind
  amount: number
}

export type PriceReference = {
  /** Nejnižší cena za 30 dní před slevou; `null`, když varianta není ve slevě
      nebo není z čeho počítat. */
  lowest_30d: number | null
  /** Den začátku slevy, od kterého se okno počítá (`YYYY-MM-DD`). */
  sale_started_on: string | null
  /** Historie pokrývá celé okno — jen pak smí storefront psát „za 30 dní". */
  complete: boolean
}

export const REFERENCE_WINDOW_DAYS = 30

/**
 * Kolik dní zpátky si store routa historii načítá: okno 30 dní + běh slevy do
 * 90 dní. Delší sleva se spočítá jako `complete: false` (okno vypadne z načtené
 * historie) — pravdivě, jen opatrněji.
 */
export const HISTORY_LOOKBACK_DAYS = 120

/** Kolik dní bez záznamu za sebou ještě nepřeruší běh slevy. */
export const MAX_UNRECORDED_GAP_DAYS = 3

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export const isDay = (value: unknown): value is string =>
  typeof value === "string" && DAY_RE.test(value)

/** Kalendářní den v Europe/Prague (`YYYY-MM-DD`) — nezávisle na TZ serveru. */
export const pragueDay = (date: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value
  return `${pick("year")}-${pick("month")}-${pick("day")}`
}

/** Posun o celé kalendářní dny. Počítá se v UTC nad samotným datem, takže
    přechod na letní čas den neztratí ani nezdvojí. */
export const addDays = (day: string, days: number): string => {
  const [year, month, date] = day.split("-").map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, date + days))
  return shifted.toISOString().slice(0, 10)
}

/**
 * Částka z Medusy na číslo. `calculated_amount` chodí jako číslo, ale pole
 * typu bigNumber umí přijít i jako objekt BigNumber (viz paměť „query.graph
 * a množství") nebo řetězec.
 */
export const toAmount = (value: unknown): number | null => {
  if (value == null) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === "object") {
    const candidate =
      (value as { numeric?: unknown }).numeric ??
      (value as { value?: unknown }).value
    if (candidate !== undefined) return toAmount(candidate)
    const parsed = Number(value as never)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

// ---------------------------------------------------------------------------
// Zápis (job)
// ---------------------------------------------------------------------------

export type PriceObservation = {
  variant_id: string
  currency_code: string
  kind: PriceKind
  amount: number
  price_list_id: string | null
}

type CalculatedPriceLike = {
  calculated_amount?: unknown
  original_amount?: unknown
  calculated_price?: {
    price_list_id?: string | null
    price_list_type?: string | null
  } | null
  original_price?: {
    price_list_id?: string | null
  } | null
} | null | undefined

/**
 * Co se z `calculated_price` varianty zapíše: vždy běžná cena, a akční cena
 * jen tehdy, když ji dává price-list typu „sale" a je opravdu nižší.
 */
export const observationsFromCalculatedPrice = (
  variantId: string,
  currencyCode: string,
  calculated: CalculatedPriceLike
): PriceObservation[] => {
  if (!variantId || !calculated) return []

  const currency = currencyCode.toLowerCase()
  const original = toAmount(calculated.original_amount)
  const current = toAmount(calculated.calculated_amount)
  const out: PriceObservation[] = []

  if (original != null && original > 0) {
    out.push({
      variant_id: variantId,
      currency_code: currency,
      kind: "base",
      amount: original,
      price_list_id: calculated.original_price?.price_list_id ?? null,
    })
  }

  if (
    calculated.calculated_price?.price_list_type === "sale" &&
    current != null &&
    current > 0 &&
    original != null &&
    current < original
  ) {
    out.push({
      variant_id: variantId,
      currency_code: currency,
      kind: "sale",
      amount: current,
      price_list_id: calculated.calculated_price?.price_list_id ?? null,
    })
  }

  return out
}

export type ExistingEntry = {
  id: string
  variant_id: string
  currency_code: string
  kind: PriceKind | string
  amount: unknown
}

export type DailyUpsertPlan = {
  create: Array<PriceObservation & { recorded_on: string }>
  update: Array<{ id: string; amount: number; price_list_id: string | null }>
}

const entryKey = (row: { variant_id: string; currency_code: string; kind: string }) =>
  `${row.variant_id}:${row.currency_code.toLowerCase()}:${row.kind}`

/**
 * Upsert jednoho dne: chybějící řádek se založí, existující se jen posune
 * DOLŮ (řádek dne = nejnižší cena, která ten den platila). Stejná nebo vyšší
 * cena nic nezapisuje, takže opakovaný běh je zadarmo.
 */
export const planDailyUpsert = (
  existing: ExistingEntry[],
  observations: PriceObservation[],
  day: string
): DailyUpsertPlan => {
  const byKey = new Map(existing.map((row) => [entryKey(row), row]))

  // Duplicitní pozorování v jednom běhu (dvě oblasti se stejnou měnou) → nižší.
  const lowestObserved = new Map<string, PriceObservation>()
  for (const observation of observations) {
    const key = entryKey(observation)
    const previous = lowestObserved.get(key)
    if (!previous || observation.amount < previous.amount) {
      lowestObserved.set(key, observation)
    }
  }

  const plan: DailyUpsertPlan = { create: [], update: [] }
  for (const [key, observation] of lowestObserved) {
    const row = byKey.get(key)
    if (!row) {
      plan.create.push({ ...observation, recorded_on: day })
      continue
    }
    const stored = toAmount(row.amount)
    if (stored == null || observation.amount < stored) {
      plan.update.push({
        id: row.id,
        amount: observation.amount,
        price_list_id: observation.price_list_id,
      })
    }
  }
  return plan
}

// ---------------------------------------------------------------------------
// Čtení (store routa)
// ---------------------------------------------------------------------------

export type ReferenceInput = {
  /** Historie jedné varianty v jedné měně (může být jen výsek posledních
      `HISTORY_LOOKBACK_DAYS` dní). */
  entries: PriceHistoryPoint[]
  /** Dnešek v Europe/Prague. */
  today: string
  /** Je varianta ve slevě právě teď (živá cena, ne historie)? */
  onSaleNow: boolean
  /** `starts_at` price-listu, který slevu dává, jako den v Europe/Prague. */
  priceListStartsOn?: string | null
  /** Dnešní běžná cena (živá). */
  currentBase?: number | null
}

/** Začátek souvislého běhu slevy, který trvá dodnes; `null`, když žádný není. */
export const findSaleRunStart = (
  entries: PriceHistoryPoint[],
  today: string
): string | null => {
  const days = new Map<string, { sale: boolean }>()
  let earliest: string | null = null
  for (const entry of entries) {
    if (!isDay(entry.recorded_on)) continue
    const day = days.get(entry.recorded_on) ?? { sale: false }
    if (entry.kind === "sale") day.sale = true
    days.set(entry.recorded_on, day)
    if (!earliest || entry.recorded_on < earliest) earliest = entry.recorded_on
  }
  if (!earliest) return null

  let runStart: string | null = null
  let gap = 0
  for (let cursor = today; cursor >= earliest; cursor = addDays(cursor, -1)) {
    const day = days.get(cursor)
    if (!day) {
      gap += 1
      if (gap > MAX_UNRECORDED_GAP_DAYS) break
      continue
    }
    gap = 0
    if (!day.sale) break
    runStart = cursor
  }
  return runStart
}

export const computePriceReference = (input: ReferenceInput): PriceReference => {
  const { today, onSaleNow } = input
  if (!onSaleNow || !isDay(today)) {
    return { lowest_30d: null, sale_started_on: null, complete: false }
  }

  const entries = input.entries.filter(
    (entry) =>
      isDay(entry.recorded_on) &&
      entry.recorded_on <= today &&
      Number.isFinite(entry.amount) &&
      entry.amount > 0
  )
  const historyStart = entries.reduce<string | null>(
    (min, entry) => (!min || entry.recorded_on < min ? entry.recorded_on : min),
    null
  )
  const startsOn = isDay(input.priceListStartsOn) && input.priceListStartsOn <= today
    ? input.priceListStartsOn
    : null

  const runStart = findSaleRunStart(entries, today)
  let saleStart: string
  if (runStart) {
    // Historie začala uprostřed slevy — skutečný začátek zná jen price-list.
    saleStart =
      runStart === historyStart && startsOn && startsOn < runStart
        ? startsOn
        : runStart
  } else if (!historyStart) {
    saleStart = startsOn ?? today
  } else {
    // Historie existuje, ale slevu ještě neviděla: začala po posledním běhu.
    saleStart = today
  }

  const windowStart = addDays(saleStart, -REFERENCE_WINDOW_DAYS)
  const windowEnd = addDays(saleStart, -1)
  const inWindow = entries.filter(
    (entry) => entry.recorded_on >= windowStart && entry.recorded_on <= windowEnd
  )

  const complete =
    historyStart != null && historyStart <= windowStart && inWindow.length > 0

  const candidates = inWindow.map((entry) => entry.amount)
  const currentBase = input.currentBase
  if (!complete && currentBase != null && Number.isFinite(currentBase) && currentBase > 0) {
    candidates.push(currentBase)
  }

  return {
    lowest_30d: candidates.length ? Math.min(...candidates) : null,
    sale_started_on: saleStart,
    complete,
  }
}
