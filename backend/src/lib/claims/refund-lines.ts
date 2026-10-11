import {
  validateRefundItems,
  type ClaimComponentDetail,
  type ClaimOrderItemDetail,
} from "./order-items"
import {
  MONEY_EPSILON,
  refundHistoryOf,
  requestRefunds,
  round2,
  toNumber,
  type MoneyOrder,
  type MoneyRequest,
  type RefundHistoryEntry,
  type RefundLine,
} from "./refund-rules"

/**
 * Košík vrácení (docs/reklamace-a-zruseni.md §13.2) — čistá aritmetika bez
 * kontejneru, dokazovaná testem (`__tests__/claims-13`).
 *
 * ## Proč se částka nikde nepředvyplňuje
 *
 * Do §12 engine nabízel „výchozí částku" (cena vybraných položek, jinak
 * zbývá). Majitelka ji pak jen odklikla — a výchozí hodnota je přesně ten
 * druh čísla, které nikdo nezkontroluje. Od §13.2 částku SESTAVÍ z řádků:
 * položky, komponenty balíčku, poštovné, ruční částka. Server řádky ocení
 * (žádné ceny z prohlížeče), ohlídá stropy a uloží je ke každé refundaci.
 *
 * ## Stropy
 *
 * - položka: nejvýš `refundable_quantity` (přes VŠECHNY žádosti objednávky —
 *   `validateRefundItems`), u zakázky navíc strop zaplaceného;
 * - komponenta: nejvýš `refundable_quantity` komponenty (per balíček ×
 *   nevrácené balíčky − už vrácené kusy komponenty);
 * - poštovné: JEDNOU za objednávku (`shipping_refunded` se sleduje přes
 *   `refunds[].lines` všech žádostí i `refund_history`);
 * - celkem: nejvýš „zbývá" (zachyceno − vráceno). Výslovný košík, který
 *   zbývá přesahuje, se ODMÍTNE (majitelka vidí, kde je chyba); jen tlačítko
 *   „Vrátit celou objednávku" se seřízne na zbývá, protože tam je úmysl
 *   jasný — vrátit všechno, co přišlo.
 */

export type RefundLineInput =
  | { type: "item"; line_item_id: string; quantity: number }
  | { type: "component"; line_item_id: string; product_id: string; quantity: number }
  | { type: "shipping" }
  | { type: "custom"; amount: number; label?: string | null }

export type ShippingRefundState = {
  /** `order.shipping_total` (s DPH). */
  total: number
  /** 0, nebo celé `total`, když už poštovné jednou odešlo. */
  refunded: number
  refundable: number
  /**
   * Smí se u téhle žádosti poštovné vrátit? Jen u odstoupení / vrácení (celá
   * objednávka včetně dopravy, §1832). Reklamace vrací jen cenu výrobků —
   * pak `refundable` = 0 a košík řádek poštovného odmítne.
   */
  allowed: boolean
}

/**
 * Poštovné jde vrátit jen u odstoupení a vrácení (11. 10. 2026, Matěj):
 * „u reklamace jen za produkty, jinak celé". Reklamace, rozdíl z úpravy
 * objednávky i neznámý druh ze starých řádků → bez poštovného.
 */
export const shippingRefundAllowedFor = (kind: unknown): boolean =>
  kind === "odstoupeni" || kind === "vraceni"

const hasShippingLine = (lines: RefundLine[] | null | undefined): boolean =>
  (lines ?? []).some((line) => line.type === "shipping")

/**
 * Bylo poštovné už vráceno? Přes všechny žádosti objednávky (`refunds[].lines`)
 * i přes `refund_history` (kdyby se žádost někdy ztratila — stejná pojistka
 * jako u `refundedTotal`).
 */
export const shippingRefundedOf = (
  requests: MoneyRequest[],
  history: RefundHistoryEntry[] = []
): boolean =>
  requests.some((request) =>
    requestRefunds(request).some((refund) => hasShippingLine(refund.lines))
  ) || history.some((entry) => hasShippingLine(entry.lines ?? null))

export const shippingStateOf = (
  order: MoneyOrder & { shipping_total?: unknown },
  requests: MoneyRequest[],
  options: { allowRefund?: boolean } = {}
): ShippingRefundState => {
  const allowed = options.allowRefund !== false
  const total = Math.max(0, round2(toNumber(order.shipping_total)))
  const refunded = shippingRefundedOf(requests, refundHistoryOf(order)) ? total : 0
  return {
    total,
    refunded,
    refundable: allowed ? Math.max(0, round2(total - refunded)) : 0,
    allowed,
  }
}

export const SHIPPING_LINE_TITLE = "Poštovné a balné"
export const MANUAL_AMOUNT_LABEL = "Částka zadaná ručně"
export const DEPOSIT_LINE_LABEL = "Záloha zakázky"

export const REFUND_LINES_REQUIRED =
  "Sestavte košík vrácení — vyberte položky, poštovné, nebo zadejte částku."
export const REFUND_LINE_INVALID =
  "Košík vrácení obsahuje neplatný řádek — očekává se položka, komponenta, poštovné, nebo částka."
export const REFUND_SHIPPING_TWICE =
  "Poštovné se vrací jednou — v košíku je dvakrát."
export const REFUND_SHIPPING_NONE =
  "Objednávka nemá poštovné, které by šlo vrátit."
export const REFUND_SHIPPING_ALREADY =
  "Poštovné už bylo vráceno v dřívější refundaci."
export const REFUND_SHIPPING_CLAIM =
  "U reklamace se vrací jen cena výrobků, poštovné ne. Náklady na zaslání zpět můžete přidat jako ruční částku."
export const REFUND_CUSTOM_INVALID =
  "Ruční částka musí být kladné číslo."
export const REFUND_COMPONENT_NOT_BUNDLE =
  "Vybraná položka není balíček — komponenty se vrací jen u balíčku."
export const REFUND_COMPONENT_UNKNOWN =
  "Vybraná komponenta k tomuto balíčku nepatří."

export const refundComponentTooMany = (
  item: ClaimOrderItemDetail,
  component: ClaimComponentDetail
): string =>
  `U komponenty „${component.title}“ balíčku „${item.title}“ lze vrátit nejvýš ${component.refundable_quantity} ks` +
  (component.refunded_quantity > 0 ? ` (${component.refunded_quantity} ks už vráceno)` : "") +
  "."

export const refundOverRemaining = (
  amount: number,
  remaining: number,
  fmt: (value: number) => string
): string =>
  `Košík vrácení (${fmt(amount)}) přesahuje zbývající ${fmt(remaining)} — uberte řádky, nebo zadejte nižší částku.`

/**
 * Staré tělo (§12.3 `items` / `amount`) → řádky košíku. Výslovné `lines` mají
 * přednost; `items` = řádky položek; `amount` = jeden ruční řádek. Nic z toho
 * → null (volající odmítne s `REFUND_LINES_REQUIRED`).
 */
export const legacyBodyToLines = (body: {
  lines?: unknown
  items?: unknown
  amount?: unknown
}): unknown[] | null => {
  if (Array.isArray(body.lines) && body.lines.length) {
    return body.lines
  }
  if (Array.isArray(body.items) && body.items.length) {
    return body.items.map((entry: any) => ({
      type: "item",
      line_item_id: entry?.line_item_id ?? entry?.id,
      quantity: entry?.quantity,
    }))
  }
  const amount = toNumber(body.amount)
  if (amount > 0) {
    return [{ type: "custom", amount, label: MANUAL_AMOUNT_LABEL }]
  }
  return null
}

/**
 * „Vrátit celou objednávku" (§13.2 `scope: "all"`): všechny zbývající kusy
 * každé položky + poštovné, pokud ještě neodešlo a žádost ho smí vracet
 * (`allowed` — u reklamace ne). Balíček se vrací jako celek (položkou), ne po
 * komponentách.
 */
export const allRemainingLines = (
  items: ClaimOrderItemDetail[],
  shipping: ShippingRefundState
): RefundLineInput[] => {
  const lines: RefundLineInput[] = items
    .filter(
      (item) => item.refundable_quantity > 0 && item.refundable_amount > MONEY_EPSILON
    )
    .map((item) => ({
      type: "item" as const,
      line_item_id: item.line_item_id,
      quantity: item.refundable_quantity,
    }))
  if (shipping.refundable > MONEY_EPSILON) {
    lines.push({ type: "shipping" })
  }
  return lines
}

/**
 * Co přesně vrací výslovné „Vrátit vše" (`scope: "all"`) — JEDNO pravidlo pro
 * refundaci i náhled v adminu (`detail.ts` → `refund_all`), ať tlačítko ukazuje
 * tutéž částku, jakou server pošle:
 *
 * - odstoupení / vrácení (`shipping.allowed`): celá objednávka — všechny
 *   zbývající kusy + poštovné; když už žádný kus nezbývá a peníze ano, zbytek
 *   jako částka;
 * - reklamace (poštovné nejde): jen VÝROBKY — reklamované kusy
 *   (`selected_in_claim`, nejvýš co ještě jde vrátit); bez výběru (starší
 *   žádost) všechny zbývající kusy. Žádné poštovné, žádný „zbytek".
 */
export const refundAllLines = (
  items: ClaimOrderItemDetail[],
  shipping: ShippingRefundState,
  remaining: number
): RefundLineInput[] => {
  if (!shipping.allowed) {
    const claimed = items.filter((item) => item.selected_in_claim > 0)
    const source = claimed.length
      ? claimed.map((item) => ({
          ...item,
          refundable_quantity: Math.min(item.refundable_quantity, item.selected_in_claim),
        }))
      : items
    return allRemainingLines(source, shipping)
  }
  const lines = allRemainingLines(items, shipping)
  if (!lines.length && remaining > MONEY_EPSILON) {
    return [{ type: "custom", amount: round2(remaining), label: "Zbývající částka" }]
  }
  return lines
}

export type RefundLinesVerdict =
  | { ok: true; lines: RefundLine[]; amount: number; clamped: boolean }
  | { ok: false; message: string }

export type PriceRefundLinesInput = {
  items: ClaimOrderItemDetail[]
  shipping: ShippingRefundState
  lines: unknown
  remaining: number
  /** Jen „Vrátit celou objednávku": přesah přes zbývá seříznout místo odmítnutí. */
  clampToRemaining?: boolean
  fmt?: (value: number) => string
}

const defaultFmt = (value: number): string => `${round2(value)}`

/**
 * Ocení košík a ohlídá stropy (hlavička souboru). Položky téhož řádku se
 * sloučí (součet kusů); pořadí výstupu = položky, komponenty, poštovné, ruční
 * částky — v tomhle pořadí se při seříznutí ubírá odzadu (ruční částka a
 * poštovné jdou první, zboží zůstává celé).
 */
export const priceRefundLines = (input: PriceRefundLinesInput): RefundLinesVerdict => {
  const fmt = input.fmt ?? defaultFmt
  if (!Array.isArray(input.lines) || !input.lines.length) {
    return { ok: false, message: REFUND_LINES_REQUIRED }
  }

  const itemSelection: Array<{ line_item_id: string; quantity: number }> = []
  const componentSelection = new Map<string, { line_item_id: string; product_id: string; quantity: number }>()
  let shippingCount = 0
  const customLines: RefundLine[] = []

  for (const raw of input.lines as any[]) {
    const type = raw?.type
    if (type === "item") {
      itemSelection.push({ line_item_id: raw.line_item_id, quantity: raw.quantity })
    } else if (type === "component") {
      const lineItemId = typeof raw.line_item_id === "string" ? raw.line_item_id : ""
      const productId = typeof raw.product_id === "string" ? raw.product_id : ""
      const quantity = toNumber(raw.quantity)
      if (!lineItemId || !productId) {
        return { ok: false, message: REFUND_COMPONENT_UNKNOWN }
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        return { ok: false, message: "Počet kusů komponenty musí být celé číslo, aspoň 1." }
      }
      const key = `${lineItemId}:${productId}`
      const existing = componentSelection.get(key)
      componentSelection.set(key, {
        line_item_id: lineItemId,
        product_id: productId,
        quantity: (existing?.quantity ?? 0) + quantity,
      })
    } else if (type === "shipping") {
      shippingCount += 1
    } else if (type === "custom") {
      const amount = round2(toNumber(raw.amount))
      if (!(amount > MONEY_EPSILON)) {
        return { ok: false, message: REFUND_CUSTOM_INVALID }
      }
      const label =
        typeof raw.label === "string" && raw.label.trim() ? raw.label.trim().slice(0, 200) : "Vrácení"
      customLines.push({ type: "custom", title: label, quantity: 1, unit_total: amount, amount })
    } else {
      return { ok: false, message: REFUND_LINE_INVALID }
    }
  }

  const priced: RefundLine[] = []

  // 1) položky — stejná pravidla jako §12.3 (strop přes všechny žádosti,
  //    zakázka jen do zaplaceného).
  if (itemSelection.length) {
    const verdict = validateRefundItems(input.items, itemSelection)
    if (verdict.ok === false) {
      return { ok: false, message: verdict.message }
    }
    for (const entry of verdict.items) {
      priced.push({
        type: "item",
        line_item_id: entry.line_item_id,
        quantity: entry.quantity,
        title: entry.title ?? null,
        unit_total: entry.unit_total ?? 0,
        amount: entry.amount ?? 0,
      })
    }
  }

  // 2) komponenty balíčku (§13.5)
  const byId = new Map(input.items.map((item) => [item.line_item_id, item]))
  for (const selection of componentSelection.values()) {
    const item = byId.get(selection.line_item_id)
    if (!item) {
      return { ok: false, message: "Některá z vybraných položek k této objednávce nepatří." }
    }
    if (!item.is_bundle || !item.components?.length) {
      return { ok: false, message: REFUND_COMPONENT_NOT_BUNDLE }
    }
    const component = item.components.find((entry) => entry.product_id === selection.product_id)
    if (!component) {
      return { ok: false, message: REFUND_COMPONENT_UNKNOWN }
    }
    if (selection.quantity > component.refundable_quantity) {
      return { ok: false, message: refundComponentTooMany(item, component) }
    }
    priced.push({
      type: "component",
      line_item_id: item.line_item_id,
      product_id: component.product_id,
      variant_id: component.variant_id,
      quantity: selection.quantity,
      title: component.title,
      unit_total: component.unit_share,
      amount: round2(component.unit_share * selection.quantity),
    })
  }

  // 3) poštovné — jednou
  if (shippingCount > 1) {
    return { ok: false, message: REFUND_SHIPPING_TWICE }
  }
  if (shippingCount === 1) {
    if (input.shipping.allowed === false) {
      return { ok: false, message: REFUND_SHIPPING_CLAIM }
    }
    if (!(input.shipping.total > MONEY_EPSILON)) {
      return { ok: false, message: REFUND_SHIPPING_NONE }
    }
    if (!(input.shipping.refundable > MONEY_EPSILON)) {
      return { ok: false, message: REFUND_SHIPPING_ALREADY }
    }
    priced.push({
      type: "shipping",
      quantity: 1,
      title: SHIPPING_LINE_TITLE,
      unit_total: input.shipping.refundable,
      amount: input.shipping.refundable,
    })
  }

  // 4) ruční částky
  priced.push(...customLines)

  const total = round2(priced.reduce((sum, line) => sum + line.amount, 0))
  if (!(total > MONEY_EPSILON)) {
    return {
      ok: false,
      message: "Za vybrané řádky není co vrátit — mají nulovou cenu, nebo už jsou vrácené.",
    }
  }
  const remaining = Math.max(0, round2(input.remaining))
  if (total <= remaining + MONEY_EPSILON) {
    return { ok: true, lines: priced, amount: total, clamped: false }
  }
  if (!input.clampToRemaining) {
    return { ok: false, message: refundOverRemaining(total, remaining, fmt) }
  }
  return { ok: true, ...clampLinesToRemaining(priced, remaining), clamped: true }
}

/**
 * Seříznutí košíku na „zbývá": ubírá se ODZADU (ruční částky, poštovné, pak
 * komponenty, pak položky), řádek, který se nevejde celý, dostane jen zbytek
 * (kusy zůstávají — protokol řekne „2 ks · 300 Kč", ne lež o ceně za kus).
 */
export const clampLinesToRemaining = (
  lines: RefundLine[],
  remaining: number
): { lines: RefundLine[]; amount: number } => {
  const kept: RefundLine[] = []
  let budget = Math.max(0, round2(remaining))
  for (const line of lines) {
    if (budget <= MONEY_EPSILON) break
    if (line.amount <= budget + MONEY_EPSILON) {
      kept.push(line)
      budget = round2(budget - line.amount)
      continue
    }
    kept.push({ ...line, amount: budget })
    budget = 0
  }
  return { lines: kept, amount: round2(kept.reduce((sum, line) => sum + line.amount, 0)) }
}

const fmtMoney = (amount: number, currency: string): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: String(currency || "CZK").toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

/** Jeden řádek košíku slovy: „Název · 2 ks · 1 200 Kč" / „Poštovné a balné · 129 Kč". */
export const refundLineText = (line: RefundLine, currency: string): string => {
  const title =
    line.type === "custom"
      ? `Vrácení — ${line.title ?? "částka"}`
      : line.type === "shipping"
        ? line.title ?? SHIPPING_LINE_TITLE
        : line.type === "component"
          ? `${line.title ?? "Komponenta"} (komponenta balíčku)`
          : line.title ?? "Položka"
  const quantity =
    (line.type === "item" || line.type === "component") && (line.quantity ?? 0) > 0
      ? `${line.quantity} ks`
      : null
  return [title, quantity, fmtMoney(line.amount, currency)].filter(Boolean).join(" · ")
}

/** Řádky košíku, každý na svém řádku; null bez řádků (starší refundace). */
export const refundLinesText = (
  lines: RefundLine[] | null | undefined,
  currency: string
): string | null =>
  lines && lines.length ? lines.map((line) => refundLineText(line, currency)).join("\n") : null

/** Všechny řádky přes všechny refundace žádosti (do potvrzení o vyřízení). */
export const requestRefundLinesText = (
  request: MoneyRequest,
  currency: string
): string | null => {
  const lines = requestRefunds(request).flatMap((refund) => refund.lines ?? [])
  return refundLinesText(lines, currency)
}

/** `items` zrcadlo (§12.3) z řádků položek — pro starší čtenáře `refunds[].items`. */
export const itemsMirrorOf = (lines: RefundLine[]) =>
  lines
    .filter((line) => line.type === "item" && line.line_item_id)
    .map((line) => ({
      line_item_id: line.line_item_id as string,
      quantity: line.quantity ?? 0,
      title: line.title ?? null,
      unit_total: line.unit_total ?? 0,
      amount: line.amount,
    }))
