import { lineQuantityOf } from "../order-quantity"
import { MONEY_EPSILON, round2, toNumber } from "./refund-rules"

/**
 * Položky žádosti (docs/reklamace-a-zruseni.md §11.1–11.2) — čistá aritmetika
 * a pravidla bez kontejneru, aby je šlo dokázat testem
 * (`__tests__/claims-line-items`).
 *
 * ## Proč snapshot, a proč „po slevě, s DPH"
 *
 * Žádost si ukládá KOPII vybraných řádků, ne odkazy: objednávka se může ještě
 * upravit (výměna varianty, zrušený řádek) a protokol musí říkat, co zákazník
 * reklamoval v den podání. Částky se berou z `item.total` objednávky — to je
 * cena po slevových kódech a včetně DPH, tedy přesně to, co zákazník zaplatil
 * a co se mu má případně vrátit. `unit_price` je jen záloha pro řádky, kde
 * `total` chybí (dotaz bez `total` na objednávce totiž `decorateCartTotals`
 * nespustí — viz `CLAIM_ORDER_FIELDS`).
 */

/** Jeden řádek `return_request.line_items`. */
export type ClaimLineItem = {
  line_item_id: string
  title: string
  variant_title: string | null
  thumbnail: string | null
  quantity: number
  /** Za kus — po slevě, s DPH. */
  unit_price: number
  /** `unit_price × quantity`. */
  total: number
  currency_code: string
}

/** Co posílá storefront: `{ id, quantity }` za každou vybranou položku. */
export type ClaimItemSelection = { id: string; quantity: number }

/** Řádek objednávky tak, jak ho vrací `query.graph` s `items.*` + `total`. */
export type ClaimSourceItem = {
  id?: string
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  thumbnail?: string | null
  unit_price?: unknown
  total?: unknown
  quantity?: unknown
  raw_quantity?: unknown
  detail?: { quantity?: unknown; raw_quantity?: unknown } | null
}

export type ClaimSourceOrder = {
  currency_code?: string | null
  items?: ClaimSourceItem[] | null
}

/** Název řádku pro zákazníka — produkt má přednost před interním `title`. */
export const itemTitleOf = (item: ClaimSourceItem): string =>
  String(item.product_title || item.title || "Položka").trim()

/**
 * Cena za kus PO slevě a S DPH: `item.total / množství`. Když `total` na
 * řádku vůbec není (dotaz bez `total` → `decorateCartTotals` neběžel), bere
 * se `unit_price`. Přítomná nula je ale pravda (100% sleva = zákazník
 * nezaplatil nic), ne chybějící údaj. Nikdy NaN — řádek bez ceny dá 0.
 */
export const perUnitOf = (item: ClaimSourceItem): number => {
  const quantity = lineQuantityOf(item)
  const hasTotal =
    item.total !== undefined && item.total !== null && item.total !== ""
  if (hasTotal && quantity > 0) {
    return round2(toNumber(item.total) / quantity)
  }
  return round2(toNumber(item.unit_price))
}

/** Veřejný tvar řádku objednávky pro výběr ve formuláři (`order_items` v GET). */
export type ClaimOrderItemView = {
  id: string
  title: string
  variant_title: string | null
  thumbnail: string | null
  quantity: number
  unit_price: number
  total: number
}

export const orderItemsForClaims = (
  order: ClaimSourceOrder
): ClaimOrderItemView[] =>
  (order.items ?? [])
    .filter((item) => typeof item?.id === "string" && item.id)
    .map((item) => {
      const quantity = lineQuantityOf(item)
      const unit = perUnitOf(item)
      return {
        id: item.id as string,
        title: itemTitleOf(item),
        variant_title: item.variant_title?.trim() || null,
        thumbnail: item.thumbnail || null,
        quantity,
        unit_price: unit,
        total: round2(unit * quantity),
      }
    })

export type LineItemsVerdict =
  | { ok: true; line_items: ClaimLineItem[] | null }
  | { ok: false; message: string }

export const ITEMS_REQUIRED_FOR_CLAIM =
  "U reklamace prosím vyberte, kterého zboží se týká — aspoň jednu položku."
export const ITEMS_NOT_IN_ORDER =
  "Některá z vybraných položek k této objednávce nepatří. Obnovte prosím stránku a zkuste to znovu."
export const ITEMS_QUANTITY_TOO_HIGH =
  "U některé položky je zadaný vyšší počet kusů, než bylo objednáno."
export const ITEMS_QUANTITY_INVALID =
  "Počet kusů musí být celé číslo, aspoň 1."
export const PHOTOS_REQUIRED_FOR_CARRIER_DAMAGE =
  "U poškození přepravou prosím přiložte aspoň jednu fotku poškozené zásilky nebo zboží — bez ní nemůžeme reklamaci u dopravce uplatnit."

/**
 * Pravidla §11.1 a sestavení snapshotu v jednom kroku:
 * - `reklamace` → aspoň jedna položka;
 * - `vraceni` → volitelné (bez položek = vše → null);
 * - `odstoupeni` → výběr se ignoruje, odstupuje se od celé smlouvy → null;
 * - id musí patřit objednávce, množství celé, 1 ≤ q ≤ objednané.
 *
 * `selection` null/undefined = volající BEZ výběru položek (záložní routa
 * číslo + e-mail, staré formuláře) — pravidlo „aspoň jedna" se nevynucuje,
 * jinak by záložní cesta u reklamace přestala fungovat. Tokenová routa posílá
 * vždy pole (i prázdné), takže u ní pravidlo platí. Duplicitní id se sloučí
 * (součet kusů), ať formulář nemusí hlídat unikátnost.
 */
export const resolveClaimLineItems = (
  order: ClaimSourceOrder,
  kind: string | null | undefined,
  selection: ClaimItemSelection[] | null | undefined
): LineItemsVerdict => {
  if (kind === "odstoupeni") {
    return { ok: true, line_items: null }
  }
  if (selection === undefined || selection === null) {
    return { ok: true, line_items: null }
  }

  const merged = new Map<string, number>()
  for (const entry of selection) {
    if (!entry || typeof entry.id !== "string" || !entry.id) {
      return { ok: false, message: ITEMS_NOT_IN_ORDER }
    }
    const quantity = toNumber(entry.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { ok: false, message: ITEMS_QUANTITY_INVALID }
    }
    merged.set(entry.id, (merged.get(entry.id) ?? 0) + quantity)
  }

  if (!merged.size) {
    if (kind === "reklamace") {
      return { ok: false, message: ITEMS_REQUIRED_FOR_CLAIM }
    }
    return { ok: true, line_items: null }
  }

  const byId = new Map(
    (order.items ?? [])
      .filter((item) => typeof item?.id === "string")
      .map((item) => [item.id as string, item])
  )
  const currency = String(order.currency_code || "czk").toLowerCase()
  const lineItems: ClaimLineItem[] = []
  for (const [id, quantity] of merged) {
    const source = byId.get(id)
    if (!source) {
      return { ok: false, message: ITEMS_NOT_IN_ORDER }
    }
    const ordered = lineQuantityOf(source)
    if (ordered > 0 && quantity > ordered) {
      return { ok: false, message: ITEMS_QUANTITY_TOO_HIGH }
    }
    const unit = perUnitOf(source)
    lineItems.push({
      line_item_id: id,
      title: itemTitleOf(source),
      variant_title: source.variant_title?.trim() || null,
      thumbnail: source.thumbnail || null,
      quantity,
      unit_price: unit,
      total: round2(unit * quantity),
      currency_code: currency,
    })
  }
  return { ok: true, line_items: lineItems }
}

/** `line_items` z řádku žádosti — jen validní položky, cokoli jiného = []. */
export const claimLineItemsOf = (value: unknown): ClaimLineItem[] =>
  Array.isArray(value)
    ? value
        .filter((entry) => entry && typeof entry === "object")
        .map((entry: any) => ({
          line_item_id: String(entry.line_item_id ?? entry.id ?? ""),
          title: String(entry.title ?? "Položka"),
          variant_title:
            typeof entry.variant_title === "string" && entry.variant_title.trim()
              ? entry.variant_title.trim()
              : null,
          thumbnail: typeof entry.thumbnail === "string" ? entry.thumbnail : null,
          quantity: Math.max(0, toNumber(entry.quantity)),
          unit_price: toNumber(entry.unit_price),
          total: toNumber(entry.total),
          currency_code: String(entry.currency_code || "czk").toLowerCase(),
        }))
    : []

/** Σ `line_items.total` — cena vybraných položek. */
export const lineItemsTotal = (lineItems: unknown): number =>
  round2(claimLineItemsOf(lineItems).reduce((sum, item) => sum + item.total, 0))

/**
 * Výchozí částka refundace (§11.2): s položkami `min(zbývá, Σ položek)`,
 * bez položek celé „zbývá". Vždy číslo — panel „Vrátit peníze" ji předvyplní
 * rovnou; zda jde o „cenu vybraných položek", pozná z `line_items`.
 */
export const suggestedRefundAmount = (
  remaining: number,
  lineItems: unknown
): number => {
  const safeRemaining = Math.max(0, round2(toNumber(remaining)))
  const items = claimLineItemsOf(lineItems)
  if (!items.length) {
    return safeRemaining
  }
  const total = lineItemsTotal(items)
  if (total <= MONEY_EPSILON) {
    return safeRemaining
  }
  return Math.min(safeRemaining, total)
}

const fmtMoney = (amount: number, currency: string): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: String(currency || "CZK").toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

/** Jeden řádek: „Název · varianta · N ks · částka" (varianta jen když je). */
export const lineItemLine = (item: ClaimLineItem): string =>
  [
    item.title,
    item.variant_title,
    `${item.quantity} ks`,
    fmtMoney(item.total, item.currency_code),
  ]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .join(" · ")

/**
 * Formátovaný seznam položek pro protokol, e-maily a zvonek (§11.5) — řádek
 * za položku, oddělené `\n`. Null, když žádost položky nemá, ať volající může
 * spadnout na starý textový `items`.
 */
export const lineItemsText = (lineItems: unknown): string | null => {
  const items = claimLineItemsOf(lineItems)
  if (!items.length) {
    return null
  }
  return items.map(lineItemLine).join("\n")
}

/** Položky slovy: nové `line_items`, jinak starý text zákazníka, jinak null. */
export const claimItemsText = (request: {
  line_items?: unknown
  items?: unknown
}): string | null => {
  const formatted = lineItemsText(request.line_items)
  if (formatted) return formatted
  return typeof request.items === "string" && request.items.trim().length
    ? request.items.trim()
    : null
}
