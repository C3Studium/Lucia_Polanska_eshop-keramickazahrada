import { lineQuantityOf } from "../order-quantity"
import { isMadeToOrderItem, type ClaimOrderItem } from "./context"
import { claimLineItemsOf, itemTitleOf, perUnitOf } from "./line-items"
import {
  MONEY_EPSILON,
  requestRefunds,
  round2,
  toNumber,
  type MoneyRequest,
  type RefundItemEntry,
} from "./refund-rules"

/**
 * Položky OBJEDNÁVKY pro stránku žádosti a refund po položkách
 * (docs/reklamace-a-zruseni.md §12.2–12.3). Čistá aritmetika bez kontejneru —
 * detail i refundační engine počítají tímtéž (`__tests__/claims-case`).
 *
 * ## Proč se „už vráceno" počítá přes VŠECHNY žádosti objednávky
 *
 * Jedna položka může figurovat ve dvou žádostech (reklamace, pak vrácení
 * zbytku). Kdyby se `refunded_quantity` bralo jen z aktuální žádosti, šla by
 * tatáž mísa vrátit dvakrát — jednou v každé. Proto se sčítají
 * `refunds[].items` ze všech sourozenců (stejně jako `refundedTotal` sčítá
 * peníze přes sourozence).
 *
 * ## Strop u zakázkové položky
 *
 * `unit_total` zakázkového řádku je domluvená cena, ale zákazník zaplatil jen
 * zálohu (doplatek až po výrobě). Vrátit víc, než přišlo, nejde — proto
 * `refundable_amount` u zakázky = min(cena × ks, co je skutečně zaplaceno a
 * ještě nevráceno). Běžné položky strop nemají; celkový strop „zbývá" hlídá
 * engine (`clampRefundAmount`).
 */

export type ClaimOrderItemDetail = {
  line_item_id: string
  title: string
  variant_title: string | null
  thumbnail: string | null
  quantity: number
  /** Za kus — po slevě, s DPH (`item.total / quantity`). */
  unit_total: number
  /** `unit_total × quantity`. */
  line_total: number
  is_made_to_order: boolean
  /** Σ `refunds[].items` přes všechny žádosti objednávky. */
  refunded_quantity: number
  refundable_quantity: number
  /** `unit_total × refundable_quantity`, u zakázky omezeno zaplaceným. */
  refundable_amount: number
  /** Kolik kusů téhle položky zákazník v žádosti vybral (0 = nevybral). */
  selected_in_claim: number
}

/** Σ vrácených kusů za položku přes všechny žádosti objednávky. */
export const refundedQuantitiesOf = (
  requests: MoneyRequest[]
): Map<string, number> => {
  const totals = new Map<string, number>()
  for (const request of requests) {
    for (const refund of requestRefunds(request)) {
      for (const item of refund.items ?? []) {
        totals.set(
          item.line_item_id,
          (totals.get(item.line_item_id) ?? 0) + Math.max(0, toNumber(item.quantity))
        )
      }
    }
  }
  return totals
}

export type BuildClaimOrderItemsInput = {
  order: { items?: ClaimOrderItem[] | null }
  /** Všechny žádosti objednávky (včetně té aktuální). */
  requests: MoneyRequest[]
  /** Aktuální žádost — pro `selected_in_claim` z `line_items`. */
  request: { line_items?: unknown } | null | undefined
  /**
   * Co je za zakázku skutečně zaplaceno a ještě nevráceno (záloha + doplatek
   * − vrácená záloha). `null` = objednávka bez zakázky → bez stropu.
   */
  commissionPaidRemaining: number | null
}

export const buildClaimOrderItems = ({
  order,
  requests,
  request,
  commissionPaidRemaining,
}: BuildClaimOrderItemsInput): ClaimOrderItemDetail[] => {
  const refunded = refundedQuantitiesOf(requests)
  const selected = new Map(
    claimLineItemsOf(request?.line_items).map((line) => [line.line_item_id, line.quantity])
  )
  // Strop zakázky se čerpá napříč zakázkovými řádky (zpravidla je jeden).
  let commissionLeft =
    commissionPaidRemaining === null ? null : Math.max(0, round2(commissionPaidRemaining))

  return (order.items ?? [])
    .filter((item) => typeof item?.id === "string" && item.id)
    .map((item) => {
      const id = item.id as string
      const quantity = lineQuantityOf(item)
      const unit = perUnitOf(item)
      const refundedQuantity = Math.min(quantity, refunded.get(id) ?? 0)
      const refundableQuantity = Math.max(0, quantity - refundedQuantity)
      const madeToOrder = isMadeToOrderItem(item)
      let refundableAmount = round2(unit * refundableQuantity)
      if (madeToOrder && commissionLeft !== null) {
        refundableAmount = round2(Math.min(refundableAmount, commissionLeft))
        commissionLeft = round2(Math.max(0, commissionLeft - refundableAmount))
      }
      return {
        line_item_id: id,
        title: itemTitleOf(item),
        variant_title: item.variant_title?.trim() || null,
        thumbnail: item.thumbnail || null,
        quantity,
        unit_total: unit,
        line_total: round2(unit * quantity),
        is_made_to_order: madeToOrder,
        refunded_quantity: refundedQuantity,
        refundable_quantity: refundableQuantity,
        refundable_amount: refundableAmount,
        selected_in_claim: selected.get(id) ?? 0,
      }
    })
}

export const REFUND_ITEMS_REQUIRED =
  "Vyberte aspoň jednu položku, za kterou se vrací peníze."
export const REFUND_ITEMS_NOT_IN_ORDER =
  "Některá z vybraných položek k této objednávce nepatří."
export const REFUND_ITEMS_QUANTITY_INVALID =
  "Počet kusů k vrácení musí být celé číslo, aspoň 1."

export const refundItemsTooMany = (item: ClaimOrderItemDetail): string =>
  `U položky „${item.title}“ lze vrátit nejvýš ${item.refundable_quantity} ks` +
  (item.refunded_quantity > 0 ? ` (${item.refunded_quantity} ks už vráceno)` : "") +
  "."

export type RefundItemsVerdict =
  | { ok: true; items: RefundItemEntry[]; amount: number }
  | { ok: false; message: string }

/**
 * §12.3 `scope: "items"`: každá položka musí patřit objednávce, množství celé
 * ≥ 1 a nejvýš `refundable_quantity` (tutéž položku nejde vrátit dvakrát).
 * Částka = Σ `unit_total × quantity`; u zakázkového řádku nejvýš
 * `refundable_amount` (strop zaplaceného). Duplicitní id se sloučí.
 */
export const validateRefundItems = (
  items: ClaimOrderItemDetail[],
  selection: unknown
): RefundItemsVerdict => {
  if (!Array.isArray(selection) || !selection.length) {
    return { ok: false, message: REFUND_ITEMS_REQUIRED }
  }
  const merged = new Map<string, number>()
  for (const entry of selection as any[]) {
    const id = typeof entry?.line_item_id === "string" ? entry.line_item_id : entry?.id
    if (typeof id !== "string" || !id) {
      return { ok: false, message: REFUND_ITEMS_NOT_IN_ORDER }
    }
    const quantity = toNumber(entry?.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { ok: false, message: REFUND_ITEMS_QUANTITY_INVALID }
    }
    merged.set(id, (merged.get(id) ?? 0) + quantity)
  }

  const byId = new Map(items.map((item) => [item.line_item_id, item]))
  const result: RefundItemEntry[] = []
  let amount = 0
  for (const [id, quantity] of merged) {
    const item = byId.get(id)
    if (!item) {
      return { ok: false, message: REFUND_ITEMS_NOT_IN_ORDER }
    }
    if (quantity > item.refundable_quantity) {
      return { ok: false, message: refundItemsTooMany(item) }
    }
    const part = round2(Math.min(item.unit_total * quantity, item.refundable_amount))
    result.push({
      line_item_id: id,
      quantity,
      title: item.title,
      unit_total: item.unit_total,
      amount: part,
    })
    amount = round2(amount + part)
  }
  if (!(amount > MONEY_EPSILON)) {
    return {
      ok: false,
      message: "Za vybrané položky není co vrátit — mají nulovou cenu, nebo už jsou vrácené.",
    }
  }
  return { ok: true, items: result, amount }
}
