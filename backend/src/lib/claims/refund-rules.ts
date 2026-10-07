import { isFinalStatus } from "./constants"

/**
 * Pravidla refundace modulu „Reklamace a zrušení" (docs/reklamace-a-zruseni.md §3)
 * a peněžní aritmetika kolem nich. Všechno čisté — žádný kontejner, žádné
 * dotazy — aby to šlo dokázat testem (`__tests__/claims-refund-rules`).
 *
 * ## Proč `toNumber` a ne `Number()`
 *
 * `query.graph` vrací částky jako BigNumber (`{ value, precision }` nebo
 * `{ numeric_ }`). `Number({value})` je NaN, a NaN v součtu znamená „zachyceno
 * 0" → tiše přeskočená refundace nebo naopak nehlídaný strop. Repo si na to
 * už jednou naběhlo (made-to-order cancel), proto jedna funkce pro všechny.
 */

export const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>
    return toNumber(source.value ?? source.numeric_ ?? source.raw_ ?? source.raw ?? 0)
  }
  return 0
}

export const round2 = (value: number): number => Math.round(value * 100) / 100

/** Haléřová tolerance — pod ní je rozdíl jen zaokrouhlení, ne dluh. */
export const MONEY_EPSILON = 0.005

export type RefundMethod = "comgate" | "manual"

/** Jedna položka `return_request.refunds`. */
export type RefundEntry = {
  amount: number
  method: RefundMethod
  at: string
  note?: string | null
}

export type RefundHistoryEntry = {
  amount?: unknown
  return_request_id?: string | null
  refunded_at?: string | null
  method?: string | null
  reason?: string | null
}

export type MoneyPayment = {
  id?: string
  provider_id?: string | null
  amount?: unknown
  captured_at?: unknown
  canceled_at?: unknown
  refunds?: Array<{ amount?: unknown }> | null
}

export type MoneyOrder = {
  currency_code?: string | null
  payment_collections?: Array<{ payments?: MoneyPayment[] | null }> | null
  metadata?: Record<string, unknown> | null
}

export type MoneyRequest = {
  id: string
  refunds?: unknown
  refund_amount?: unknown
}

/** Zachycené, nezrušené platby objednávky. */
export const capturedPayments = (order: MoneyOrder): MoneyPayment[] =>
  (order.payment_collections ?? [])
    .flatMap((collection) => collection?.payments ?? [])
    .filter((payment) => Boolean(payment?.captured_at) && !payment?.canceled_at)

/** Kolik peněz reálně došlo (hlavní jednotky). */
export const capturedTotal = (order: MoneyOrder): number =>
  round2(
    capturedPayments(order).reduce(
      (sum, payment) => sum + toNumber(payment?.amount),
      0
    )
  )

/** Kolik na platbě ještě zbývá k nativnímu vrácení (ComGate hlídá přeplatek). */
export const paymentRemaining = (payment: MoneyPayment): number =>
  round2(
    toNumber(payment?.amount) -
      (payment?.refunds ?? []).reduce(
        (sum, refund) => sum + toNumber(refund?.amount),
        0
      )
  )

/** Součet nativních refundací (Medusa `payment.refunds`). */
export const nativeRefundedTotal = (order: MoneyOrder): number =>
  round2(
    capturedPayments(order).reduce(
      (sum, payment) =>
        sum +
        (payment?.refunds ?? []).reduce(
          (part, refund) => part + toNumber(refund?.amount),
          0
        ),
      0
    )
  )

/** `refund_history` z metadat objednávky — jen validní položky. */
export const refundHistoryOf = (order: MoneyOrder): RefundHistoryEntry[] => {
  const history = (order.metadata ?? {})?.refund_history
  return Array.isArray(history)
    ? history.filter((entry) => entry && typeof entry === "object")
    : []
}

/**
 * Refundace zapsané na žádosti. Starý řádek (před `refunds`) má jen
 * `refund_amount` — bere se jako jedna položka, ať se zpětně nic neztratí.
 */
export const requestRefunds = (request: MoneyRequest): RefundEntry[] => {
  if (Array.isArray(request.refunds)) {
    return request.refunds
      .filter((entry) => entry && typeof entry === "object")
      .map((entry: any) => ({
        amount: toNumber(entry.amount),
        method: entry.method === "comgate" ? "comgate" : "manual",
        at: typeof entry.at === "string" ? entry.at : "",
        note: typeof entry.note === "string" ? entry.note : null,
      }))
  }
  const legacy = toNumber(request.refund_amount)
  return legacy > 0 ? [{ amount: legacy, method: "manual", at: "" }] : []
}

export const requestRefundedTotal = (request: MoneyRequest): number =>
  round2(requestRefunds(request).reduce((sum, entry) => sum + entry.amount, 0))

/**
 * Celkem vráceno na objednávce — přes modul (žádosti) i mimo něj
 * (`refund_history`: „Vrátit rozdíl", zrušená zakázka).
 *
 * Refundace z modulu se zapisují na OBA konce (žádost i historie). Aby se
 * nepočítaly dvakrát, bere se za každou žádost větší z obou součtů (kdyby se
 * historie někdy ztratila — přesně ta chyba, kterou tenhle modul opravuje) a
 * z historie zbytek bez vazby na žádost. Nativní refundace Medusy jsou spodní
 * hranicí: ComGate peníze, které odešly, nejde „zapomenout".
 */
export const refundedTotal = (
  order: MoneyOrder,
  requests: MoneyRequest[]
): number => {
  const history = refundHistoryOf(order)
  const requestIds = new Set(requests.map((request) => request.id))

  const historyOther = history
    .filter(
      (entry) =>
        !entry.return_request_id || !requestIds.has(entry.return_request_id)
    )
    .reduce((sum, entry) => sum + toNumber(entry.amount), 0)

  const moduleTotal = requests.reduce((sum, request) => {
    const inHistory = history
      .filter((entry) => entry.return_request_id === request.id)
      .reduce((part, entry) => part + toNumber(entry.amount), 0)
    return sum + Math.max(inHistory, requestRefundedTotal(request))
  }, 0)

  return round2(Math.max(nativeRefundedTotal(order), historyOther + moduleTotal))
}

export type MoneyState = {
  captured: number
  refunded: number
  remaining: number
}

/** Zachyceno / vráceno / zbývá — jediný výpočet pro seznam, refundaci i pojistku. */
export const moneyState = (
  order: MoneyOrder,
  requests: MoneyRequest[]
): MoneyState => {
  const captured = capturedTotal(order)
  const refunded = refundedTotal(order, requests)
  return {
    captured,
    refunded,
    remaining: Math.max(0, round2(captured - refunded)),
  }
}

export type RefundRuleRequest = {
  kind?: string | null
  status?: string | null
  resolution?: string | null
}

export type RefundRuleBody = {
  amount?: unknown
  note?: unknown
  skip_goods_check?: unknown
  mark_resolved?: unknown
}

export type RefundVerdict = {
  allowed: boolean
  /** Česky, pro majitelku — proč to teď nejde. */
  reason: string | null
}

/**
 * Jádro §3: smí se u téhle žádosti TEĎ vracet?
 *
 * - jen `approved` / `received`;
 * - odstoupení/vrácení: jen `received`, ledaže tělo nese `skip_goods_check`
 *   (vědomě — zboží třeba nikdy neodešlo);
 * - reklamace: v `approved` jen s `resolution ∈ {refund, discount}` (peníze
 *   místo opravy, nebo sleva — zboží zůstává u zákazníka), jinak až `received`.
 */
export const canRefund = (
  request: RefundRuleRequest,
  body: RefundRuleBody = {}
): RefundVerdict => {
  const status = request.status ?? ""

  if (isFinalStatus(status)) {
    return {
      allowed: false,
      reason: "Žádost je už uzavřená — peníze se u ní nevracejí.",
    }
  }
  if (status === "pending") {
    return {
      allowed: false,
      reason: "Žádost napřed schvalte (nebo zamítněte) — peníze se vrací až po rozhodnutí.",
    }
  }
  if (status !== "approved" && status !== "received") {
    return { allowed: false, reason: "Žádost není ve stavu, kdy jde vracet peníze." }
  }

  const skipGoodsCheck = body.skip_goods_check === true

  if (request.kind === "odstoupeni" || request.kind === "vraceni") {
    if (status === "approved" && !skipGoodsCheck) {
      return {
        allowed: false,
        reason:
          "Zboží se ještě nevrátilo. Peníze smí počkat na zboží zpět (§ 1832/4) — označte „Zboží přijato“, nebo vědomě zvolte vrácení bez čekání (např. zboží nikdy neodešlo).",
      }
    }
    return { allowed: true, reason: null }
  }

  // Reklamace (i neznámý druh ze starých řádků se chová jako reklamace).
  if (status === "approved") {
    const resolution = request.resolution ?? ""
    if (resolution !== "refund" && resolution !== "discount") {
      return {
        allowed: false,
        reason:
          "U opravy nebo výměny se peníze nevrací — nejdřív označte „Zboží přijato“, pokud se nakonec vrací částka (např. oprava nejde).",
      }
    }
  }
  return { allowed: true, reason: null }
}

export type AmountVerdict = {
  amount: number
  /** Zadaná částka přesahovala „zbývá" a byla seříznuta. */
  clamped: boolean
}

/**
 * Částka: zadaná adminem, jinak celé „zbývá"; nikdy přes „zbývá". Nula nebo
 * nesmysl → 0 (volající odmítne s vysvětlením).
 */
export const clampRefundAmount = (
  requested: unknown,
  remaining: number
): AmountVerdict => {
  const wanted = toNumber(requested)
  if (!(remaining > MONEY_EPSILON)) {
    return { amount: 0, clamped: false }
  }
  if (!(wanted > 0)) {
    return { amount: round2(remaining), clamped: false }
  }
  if (wanted > remaining + MONEY_EPSILON) {
    return { amount: round2(remaining), clamped: true }
  }
  return { amount: round2(wanted), clamped: false }
}
