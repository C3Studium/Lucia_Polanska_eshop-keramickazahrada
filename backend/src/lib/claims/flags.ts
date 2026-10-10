import { isPayLaterPaymentProvider } from "../ship-gate"
import type { ClaimFlags } from "./case"
import { isMadeToOrderItem } from "./context"
import { goodsShipped } from "./money"
import { capturedPayments, MONEY_EPSILON, type MoneyState } from "./refund-rules"

/**
 * Vlajky případu (docs/reklamace-a-zruseni.md §12.2) z objednávky a peněz —
 * sdílené detailem žádosti i seznamem (`enrichWithMoney`), ať oba říkají
 * stejný `case`.
 *
 * `is_commission` = v objednávce je zakázka (řádek `production_order`, nebo
 * položka označená `made_to_order`), `is_mixed` = zakázka + běžné položky.
 * `pay_later` = dobírka / platba při vyzvednutí (lib/ship-gate), `paid_online`
 * = zachycená platba jiným než pay-later poskytovatelem (karta).
 */

/** Minimum polí objednávky, ze kterých se vlajky počítají (vedle `MONEY_STATE_FIELDS`). */
export const CLAIM_FLAG_ORDER_FIELDS = [
  "items.id",
  "items.metadata",
  "items.product.metadata",
]

const allPayments = (order: any): any[] =>
  ((order?.payment_collections ?? []) as any[]).flatMap(
    (collection) => collection?.payments ?? []
  )

export const claimFlagsOf = (
  order: any,
  state: MoneyState,
  hasProduction: boolean
): ClaimFlags => {
  const items = ((order?.items ?? []) as any[]).filter(Boolean)
  const madeToOrder = items.filter((item) => isMadeToOrderItem(item))
  return {
    goods_shipped: goodsShipped(order),
    is_commission: hasProduction || madeToOrder.length > 0,
    is_mixed: madeToOrder.length > 0 && madeToOrder.length < items.length,
    paid_online: capturedPayments(order).some(
      (payment) => !isPayLaterPaymentProvider(payment.provider_id)
    ),
    pay_later: allPayments(order).some((payment) =>
      isPayLaterPaymentProvider(payment?.provider_id)
    ),
    nothing_captured: state.captured <= MONEY_EPSILON,
  }
}
