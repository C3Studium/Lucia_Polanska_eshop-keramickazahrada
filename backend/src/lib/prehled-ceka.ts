/**
 * „Čeká na vás" v Přehledu — co dnes čeká na odpověď nebo rozhodnutí majitelky
 * (3. 11. 2026, Matěj: „dej to tam, ale tak aby to dávalo smysl, šetřilo to
 * čas a bylo to srozumitelné").
 *
 * Čisté funkce bez kontejneru: route `admin/operations/summary` načte řádky
 * z modulů a tady se rozhodne, co z nich opravdu čeká. Jedno pravidlo pro
 * všechno: počítá se jen to, kde je na tahu ONA — ne zboží na cestě od
 * zákazníka, ne zásilka, která normálně jede.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Vrácená zásilka se ukazuje týden — stejné okno jako ostatní poruchy v Přehledu. */
export const RETURNED_PARCEL_WINDOW_DAYS = 7

/**
 * Uložená zásilka „leží na poště" od pátého dne. Balíkovna drží zásilku
 * zhruba týden — pátý den je chvíle, kdy má smysl zákazníkovi připomenout,
 * ať si ji vyzvedne, dřív než se vrátí.
 */
export const STORED_PARCEL_DAYS = 5

/**
 * Žádost o změnu objednávky nemá stav „vyřízeno" (je to e-mail + zvonek,
 * `lib/order-change-request.ts`). Proto jen krátké okno — po třech dnech
 * je buď vyřízená, nebo ji má v e-mailu.
 */
export const ORDER_CHANGE_WINDOW_DAYS = 3

/** Kolik jednotlivých zásilek / žádostí se vypíše; víc jich v dílně jedné osoby nebývá. */
export const WAITING_LIST_LIMIT = 5

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>
    return toNumber(source.value ?? source.numeric_ ?? 0)
  }
  return 0
}

const timeOf = (value: unknown): number | null => {
  if (!value) return null
  const time = new Date(value as string).getTime()
  return Number.isFinite(time) ? time : null
}

const daysBetween = (from: number, to: number): number =>
  Math.max(0, Math.floor((to - from) / DAY_MS))

/* ------------------------------------------------------------------ */
/* Zakázky                                                             */
/* ------------------------------------------------------------------ */

export type ProductionLike = {
  stage?: string | null
  agreed_total?: unknown
  final_total_confirmed_at?: unknown
}

/**
 * Zakázka, u které je na tahu majitelka: nové zadání k potvrzení, nebo
 * výrobek s cenou po domluvě, kterému ještě neodešla cena (potvrzená
 * zakázka s nulovou cenou — `lib/made-to-order/agreed-price.ts`).
 *
 * `isAgreedPrice` dodává route (`isAgreedPriceCommission`), ať tu nežije
 * druhá definice „ceny po domluvě".
 */
export const commissionsWaitingForOwner = <T extends ProductionLike>(
  productions: T[],
  isAgreedPrice: (production: T) => boolean
): T[] =>
  productions.filter((production) => {
    if (production.stage === "specification_pending") return true
    return (
      production.stage === "confirmed" &&
      isAgreedPrice(production) &&
      !production.final_total_confirmed_at &&
      toNumber(production.agreed_total) <= 0.005
    )
  })

/* ------------------------------------------------------------------ */
/* Reklamace a vrácení                                                 */
/* ------------------------------------------------------------------ */

export type ClaimLike = {
  id: string
  status?: string | null
  resolve_by?: unknown
}

export type ClaimsWaiting = {
  /** Nové žádosti k rozhodnutí (bez těch po lhůtě). */
  new: number
  /** Zboží dorazilo zpět — rozhodnout / vrátit peníze (bez těch po lhůtě). */
  received: number
  /** Nefinální žádosti po lhůtě `resolve_by` — hoří. */
  overdue: number
  /** Nejdéle prošlá žádost — odkaz rovnou na ni, když je jediná. */
  overdue_first: { id: string; status: string } | null
}

/** Stejné „otevřené" stavy jako `lib/claims/constants.ts` (OPEN_STATUSES). */
const OPEN_CLAIM_STATUSES = ["pending", "approved", "received"]

/**
 * Žádost po lhůtě se počítá JEN mezi prošlé — ne zároveň mezi nové, jinak by
 * jedna reklamace v Přehledu stála dvakrát. Schválená žádost před lhůtou
 * („čeká na zboží") čeká na zákazníka, ne na ni, takže se nepočítá vůbec.
 */
export const claimsWaiting = (rows: ClaimLike[], now: Date): ClaimsWaiting => {
  const result: ClaimsWaiting = { new: 0, received: 0, overdue: 0, overdue_first: null }
  let firstDue = Infinity

  for (const row of rows) {
    const status = String(row.status ?? "")
    if (!OPEN_CLAIM_STATUSES.includes(status)) continue
    const due = timeOf(row.resolve_by)
    if (due !== null && due < now.getTime()) {
      result.overdue += 1
      if (due < firstDue) {
        firstDue = due
        result.overdue_first = { id: row.id, status }
      }
      continue
    }
    if (status === "pending") result.new += 1
    if (status === "received") result.received += 1
  }

  return result
}

/* ------------------------------------------------------------------ */
/* Zásilky                                                             */
/* ------------------------------------------------------------------ */

export type ParcelLike = {
  order_id: string
  parcel_code?: string | null
  phase?: string | null
  done?: boolean | null
  stored_at?: unknown
  returned_at?: unknown
  last_state_text?: string | null
}

export type ParcelIssueKind = "returned" | "problem" | "stored"

export type ParcelIssue = {
  order_id: string
  parcel_code: string | null
  kind: ParcelIssueKind
  /** Dní od vrácení / uložení; u problému null. */
  days: number | null
  /** Co hlásí pošta — do titulku štítku. */
  text: string | null
}

/**
 * Zásilky, se kterými je potřeba něco udělat:
 * - `returned` — vrací se / vrátila se (posledních 7 dní),
 * - `problem` — pošta hlásí problém (poškozená, úložna) a sledování běží,
 * - `stored` — leží na poště 5 a víc dní a zákazník si ji nevyzvedl.
 *
 * Pořadí: vrácené, problémy, pak nejdéle ležící.
 */
export const parcelIssues = (rows: ParcelLike[], now: Date): ParcelIssue[] => {
  const nowTime = now.getTime()
  const issues: ParcelIssue[] = []

  for (const row of rows) {
    const base = {
      order_id: row.order_id,
      parcel_code: row.parcel_code ?? null,
      text: row.last_state_text ?? null,
    }
    if (row.phase === "returned") {
      const at = timeOf(row.returned_at)
      // Bez data vrácení se ukáže taky — radši jednou navíc než vůbec.
      if (at === null || nowTime - at <= RETURNED_PARCEL_WINDOW_DAYS * DAY_MS) {
        issues.push({ ...base, kind: "returned", days: at === null ? null : daysBetween(at, nowTime) })
      }
      continue
    }
    if (row.done) continue
    if (row.phase === "problem") {
      issues.push({ ...base, kind: "problem", days: null })
      continue
    }
    if (row.phase === "stored") {
      const at = timeOf(row.stored_at)
      if (at !== null && nowTime - at >= STORED_PARCEL_DAYS * DAY_MS) {
        issues.push({ ...base, kind: "stored", days: daysBetween(at, nowTime) })
      }
    }
  }

  const rank: Record<ParcelIssueKind, number> = { returned: 0, problem: 1, stored: 2 }
  return issues.sort(
    (a, b) => rank[a.kind] - rank[b.kind] || (b.days ?? 0) - (a.days ?? 0)
  )
}

/* ------------------------------------------------------------------ */
/* Žádosti o změnu objednávky                                          */
/* ------------------------------------------------------------------ */

export type OrderChangeNotificationLike = {
  resource_id?: string | null
  created_at?: unknown
}

/**
 * Jedna objednávka = jedna žádost, i když zákazník napsal dvakrát. Nejnovější
 * napřed; bez objednávky (nemělo by nastat) se řádek přeskočí, protože by
 * nebylo kam kliknout.
 */
export const orderChangeRequests = (
  rows: OrderChangeNotificationLike[]
): { order_id: string; requested_at: string | null }[] => {
  const latest = new Map<string, number>()
  for (const row of rows) {
    if (!row.resource_id) continue
    const at = timeOf(row.created_at) ?? 0
    if (!latest.has(row.resource_id) || at > (latest.get(row.resource_id) ?? 0)) {
      latest.set(row.resource_id, at)
    }
  }
  return [...latest.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([order_id, at]) => ({
      order_id,
      requested_at: at ? new Date(at).toISOString() : null,
    }))
}
