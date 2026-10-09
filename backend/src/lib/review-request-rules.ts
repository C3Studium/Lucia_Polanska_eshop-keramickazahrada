/**
 * Pravidla prosby o recenzi — čistá část jobu `request-reviews`
 * (docs/sledovani-zasilek.md §6).
 *
 * Bez containeru: job sem jen nasype řádky a dostane rozhodnutí, takže se
 * matice „kdy je převzato" a „kdy mlčet" dokazuje v unit testu.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Okno, po kterém už se neptáme: pozdní prosba působí jako hromadná rozesílka. */
export const REVIEW_WINDOW_DAYS = 30

/**
 * Nesledovaná zásilka: o doručení nevíme, tak k odeslání přičteme tři dny —
 * dnešní odhad, který platil, když se recenze počítaly od `shipped_at`.
 */
export const UNTRACKED_DELIVERY_PADDING_DAYS = 3

const toDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export type ReceivedAtInput = {
  /** Řádek `parcel_tracking` objednávky, je-li. */
  tracking?: {
    delivered_at?: Date | string | null
    done?: boolean | null
  } | null
  /** Nejpozdější `shipped_at` nezrušeného fulfillmentu. */
  shipped_at?: Date | string | null
  /** Osobní odběr: `shipped_at` = vyzvednutí (complete-personal-pickup). */
  is_pickup: boolean
}

/**
 * Okamžik „převzato" (§6):
 * - sledovaná zásilka → `delivered_at`; dokud není doručená, převzato není
 *   (a sledování uzavřené bez doručení — vrácená, vzdaná — nikdy);
 * - osobní odběr → `shipped_at` (vyzvednutí a zaplacení u pultu);
 * - nesledovaná zásilka → `shipped_at` + 3 dny.
 */
export const receivedAtFor = (input: ReceivedAtInput): Date | null => {
  if (input.tracking) {
    return toDate(input.tracking.delivered_at)
  }
  const shipped = toDate(input.shipped_at)
  if (!shipped) return null
  if (input.is_pickup) return shipped
  return new Date(shipped.getTime() + UNTRACKED_DELIVERY_PADDING_DAYS * DAY_MS)
}

/** `review_request_days` po převzetí, nejdéle 30 dnů poté. */
export const isInReviewWindow = (
  receivedAt: Date,
  waitDays: number,
  now: Date = new Date()
): boolean => {
  const due = receivedAt.getTime() + waitDays * DAY_MS
  const expires = due + REVIEW_WINDOW_DAYS * DAY_MS
  return now.getTime() >= due && now.getTime() <= expires
}

export type ClaimVerdict = "send" | "defer" | "never"

export type ClaimLike = {
  status?: string | null
  refund_amount?: unknown
  refunds?: unknown
}

const hasRefund = (claim: ClaimLike): boolean => {
  const amount = Number(claim.refund_amount ?? 0)
  if (Number.isFinite(amount) && amount > 0) return true
  return Array.isArray(claim.refunds) && claim.refunds.length > 0
}

/**
 * Reklamace / vrácení / odstoupení k objednávce (§6):
 * - otevřená (`pending` / `approved` / `received`) → odložit — až se dořeší;
 * - `rejected` / `cancelled` → nikdy; zamítnutý zákazník se o recenzi neprosí
 *   a zrušená žádost znamená, že něco nebylo v pořádku;
 * - `resolved` s vrácením peněz → nikdy (kousek už nemá, nebo dostal slevu);
 *   `resolved` bez peněz (oprava, výměna) → poslat, je spokojený.
 */
export const claimVerdict = (claims: ClaimLike[] | null | undefined): ClaimVerdict => {
  let verdict: ClaimVerdict = "send"
  for (const claim of claims ?? []) {
    const status = String(claim?.status ?? "")
    if (status === "rejected" || status === "cancelled") return "never"
    if (status === "resolved" && hasRefund(claim)) return "never"
    if (status === "pending" || status === "approved" || status === "received") {
      verdict = "defer"
    }
  }
  return verdict
}

/** Osobní odběr podle dopravní metody — stejná trojice jako `complete-personal-pickup`. */
export const isPickupOrder = (order: any): boolean =>
  ((order?.shipping_methods ?? []) as any[]).some((method) => {
    const data = method?.data || {}
    return (
      data.personal_pickup === true ||
      data.service_code === "PICKUP" ||
      String(method?.shipping_option?.provider_id ?? "").includes("pickup")
    )
  })

/** Nejpozdější odeslání nezrušeného fulfillmentu. */
export const latestShippedAt = (
  fulfillments: Array<{ shipped_at?: Date | string | null; canceled_at?: Date | string | null }> | null | undefined
): Date | null => {
  let latest: Date | null = null
  for (const fulfillment of fulfillments ?? []) {
    if (fulfillment?.canceled_at) continue
    const shipped = toDate(fulfillment?.shipped_at)
    if (shipped && (!latest || shipped > latest)) latest = shipped
  }
  return latest
}
