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

/**
 * Rozsah refundace (docs/reklamace-a-zruseni.md §12.3): `items` = vybrané
 * položky, `all` = celá objednávka (zbývá), `deposit` = záloha zakázky.
 * Starší záznamy bez rozsahu = `null` (částka zadaná ručně / výchozí).
 */
export type RefundScope = "items" | "all" | "deposit"

export const REFUND_SCOPES: readonly RefundScope[] = ["items", "all", "deposit"]

export const isRefundScope = (value: unknown): value is RefundScope =>
  typeof value === "string" && (REFUND_SCOPES as readonly string[]).includes(value)

/**
 * Položka vrácená v rámci jedné refundace (`refunds[].items`, §12.3). Z ní se
 * počítá `refunded_quantity` — tutéž položku nejde vrátit dvakrát. `title`,
 * `unit_total` a `amount` jsou snapshot pro protokol a seznam refundací.
 */
export type RefundItemEntry = {
  line_item_id: string
  quantity: number
  title?: string | null
  unit_total?: number
  amount?: number
}

/**
 * Řádek košíku vrácení (docs/reklamace-a-zruseni.md §13.2) tak, jak se UKLÁDÁ
 * do `refunds[].lines` i `refund_history[].lines` — se snapshotem názvu a
 * ceny, ať protokol i e-mail řeknou „za co", i kdyby se objednávka změnila.
 *
 * - `item`: celý řádek objednávky (`unit_total × quantity`, strop
 *   `refundable_quantity` přes všechny žádosti);
 * - `component`: komponenta balíčku (§13.5, `unit_share × quantity`, strop per
 *   komponenta);
 * - `shipping`: poštovné objednávky — JEDNOU (`shipping_refunded`);
 * - `custom`: ručně zadaná částka s popiskem (i záloha zakázky a staré
 *   `amount` tělo se mapují sem).
 */
export type RefundLineType = "item" | "component" | "shipping" | "custom"

export type RefundLine = {
  type: RefundLineType
  /** `item` / `component` — řádek objednávky. */
  line_item_id?: string | null
  /** `component` — produkt komponenty balíčku. */
  product_id?: string | null
  variant_id?: string | null
  quantity?: number
  /** Snapshot názvu (item/component) nebo popisek (shipping/custom). */
  title?: string | null
  /** Za kus: `unit_total` položky, `unit_share` komponenty. */
  unit_total?: number
  /** Částka řádku — vždy. */
  amount: number
}

export const REFUND_LINE_TYPES: readonly RefundLineType[] = [
  "item",
  "component",
  "shipping",
  "custom",
]

export const isRefundLineType = (value: unknown): value is RefundLineType =>
  typeof value === "string" && (REFUND_LINE_TYPES as readonly string[]).includes(value)

/** `lines` z libovolného záznamu refundace — jen validní řádky, cokoli jiného = []. */
export const refundLinesOf = (value: unknown): RefundLine[] =>
  Array.isArray(value)
    ? value
        .filter(
          (entry) =>
            entry && typeof entry === "object" && isRefundLineType((entry as any).type)
        )
        .map((entry: any) => ({
          type: entry.type as RefundLineType,
          line_item_id:
            typeof entry.line_item_id === "string" && entry.line_item_id
              ? entry.line_item_id
              : null,
          product_id:
            typeof entry.product_id === "string" && entry.product_id ? entry.product_id : null,
          variant_id:
            typeof entry.variant_id === "string" && entry.variant_id ? entry.variant_id : null,
          quantity: Math.max(0, toNumber(entry.quantity)),
          title: typeof entry.title === "string" ? entry.title : null,
          unit_total: toNumber(entry.unit_total),
          amount: toNumber(entry.amount),
        }))
    : []

/**
 * Dobropis k jedné refundaci (§13.3) — snapshot výsledku `issueCreditNoteForRefund`
 * na záznamu refundace, ať ho e-mail, protokol i admin čtou z jednoho místa.
 * `skipped` + `reason` = zkušební režim / bez faktury; `error` = iDoklad
 * odmítl (vývojář má upozornění).
 */
export type RefundCreditNote = {
  status: "issued" | "exists" | "skipped" | "error"
  number: string | null
  pdf_url: string | null
  reason?: string | null
}

/** Jedna položka `return_request.refunds`. */
export type RefundEntry = {
  /** `${request_id}:${pořadí}` — klíč pro dobropis a idempotenci (§13.3, §13.4). */
  id?: string | null
  amount: number
  method: RefundMethod
  at: string
  note?: string | null
  /** §12.3 — rozsah; starší záznamy ho nemají. */
  scope?: RefundScope | null
  /** §12.3 — vrácené položky (jen u `scope: "items"`; od §13.2 odvozené z `lines`). */
  items?: RefundItemEntry[] | null
  /** §13.2 — košík vrácení (starší záznamy ho nemají). */
  lines?: RefundLine[] | null
  /** §13.4 — kdo peníze vrátil: ComGate (karta) / ručně. */
  provider?: RefundMethod | null
  /** refId u ComGate = idempotency klíč Medusy (id řádku refundace). */
  provider_ref?: string | null
  provider_confirmed_at?: string | null
  provider_test?: boolean | null
  /** Součet vráceného na platbě podle dat relace ComGate (`refundedAmountMinor`). */
  provider_refunded_total?: number | null
  provider_status?: string | null
  /** §13.3 — dobropis k téhle refundaci. */
  credit_note?: RefundCreditNote | null
}

export type RefundHistoryEntry = {
  amount?: unknown
  return_request_id?: string | null
  /** §13.3 — id záznamu refundace na žádosti (`refunds[].id`). */
  refund_id?: string | null
  refunded_at?: string | null
  method?: string | null
  reason?: string | null
  scope?: RefundScope | null
  items?: RefundItemEntry[] | null
  lines?: RefundLine[] | null
}

const creditNoteOf = (value: unknown): RefundCreditNote | null => {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  const status = source.status
  if (
    status !== "issued" &&
    status !== "exists" &&
    status !== "skipped" &&
    status !== "error"
  ) {
    return null
  }
  return {
    status,
    number: typeof source.number === "string" && source.number ? source.number : null,
    pdf_url: typeof source.pdf_url === "string" && source.pdf_url ? source.pdf_url : null,
    reason: typeof source.reason === "string" && source.reason ? source.reason : null,
  }
}

/** `items` z libovolného záznamu refundace — jen validní položky, cokoli jiného = []. */
export const refundItemsOf = (value: unknown): RefundItemEntry[] =>
  Array.isArray(value)
    ? value
        .filter(
          (entry) =>
            entry &&
            typeof entry === "object" &&
            typeof (entry as any).line_item_id === "string" &&
            (entry as any).line_item_id
        )
        .map((entry: any) => ({
          line_item_id: String(entry.line_item_id),
          quantity: Math.max(0, toNumber(entry.quantity)),
          title: typeof entry.title === "string" ? entry.title : null,
          unit_total: toNumber(entry.unit_total),
          amount: toNumber(entry.amount),
        }))
    : []

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
      .map((entry: any) => {
        const items = refundItemsOf(entry.items)
        const lines = refundLinesOf(entry.lines)
        const method: RefundMethod = entry.method === "comgate" ? "comgate" : "manual"
        return {
          id: typeof entry.id === "string" && entry.id ? entry.id : null,
          amount: toNumber(entry.amount),
          method,
          at: typeof entry.at === "string" ? entry.at : "",
          note: typeof entry.note === "string" ? entry.note : null,
          // Rozsah a položky (§12.3) se musí zachovat — z nich je
          // `refunded_quantity` a krok „Záloha vrácena" v průběhu.
          scope: isRefundScope(entry.scope) ? entry.scope : null,
          items: items.length ? items : null,
          // §13.2 — košík; §13.4 — potvrzení ComGate; §13.3 — dobropis.
          lines: lines.length ? lines : null,
          provider:
            entry.provider === "comgate" || entry.provider === "manual"
              ? entry.provider
              : null,
          provider_ref:
            typeof entry.provider_ref === "string" && entry.provider_ref
              ? entry.provider_ref
              : null,
          provider_confirmed_at:
            typeof entry.provider_confirmed_at === "string" && entry.provider_confirmed_at
              ? entry.provider_confirmed_at
              : null,
          provider_test:
            typeof entry.provider_test === "boolean" ? entry.provider_test : null,
          provider_refunded_total:
            entry.provider_refunded_total === null ||
            entry.provider_refunded_total === undefined
              ? null
              : toNumber(entry.provider_refunded_total),
          provider_status:
            typeof entry.provider_status === "string" && entry.provider_status
              ? entry.provider_status
              : null,
          credit_note: creditNoteOf(entry.credit_note),
        }
      })
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
  /** `false` = zboží nikdy neodešlo (odstoupení před odesláním) → nečeká se na něj. */
  goods_shipped?: boolean | null
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
    // Zboží, které nikdy neodešlo, se nemůže vrátit — § 1832/4 tu nemá na co čekat.
    const goodsNeverShipped = request.goods_shipped === false
    if (status === "approved" && !skipGoodsCheck && !goodsNeverShipped) {
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
