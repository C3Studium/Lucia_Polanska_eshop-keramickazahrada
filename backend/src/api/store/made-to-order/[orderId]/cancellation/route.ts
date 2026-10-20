import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadCustomerOrder } from "../../../../../lib/made-to-order/customer-access"
import {
  cancellationEligibility,
  cancellationPlan,
} from "../../../../../lib/made-to-order/cancellation"
import { commissionLineOf, commissionTitleOf } from "../../../../../lib/made-to-order/commission-line"
import { commissionMoney } from "../../../../../lib/made-to-order/commission-money"
import { commissionRefundablePaid } from "../../../../../lib/made-to-order/customer-cancel"
import { commissionIdFromRequest } from "../../../../../lib/made-to-order/orders-of"
import { goodsShipped } from "../../../../../lib/claims/money"
import { isMadeToOrderItem } from "../../../../../lib/claims/made-to-order"
import {
  commissionPaidRemaining,
  loadClaimProduction,
  requireSingleCommission,
} from "../../../../../lib/claims/production"
import { loadClaimDetailOrder } from "../../../../../lib/claims/detail"
import { isServiceLine } from "../../../../../lib/packaging-lines"

/**
 * `GET /store/made-to-order/:orderId/cancellation?production_order_id=` — co se
 * stane, když zákazník zakázku zruší TEĎ (LEGAL_AUDIT.md § 0, Z4/Z5): fáze podle
 * e-mailu Z3, kolik se vrátí a kolik zůstává jako záloha. Storefront podle toho
 * kreslí tlačítko „Zrušit zakázku" a větu „vrátíme vše" / „záloha se nevrací,
 * vrátíme …".
 *
 * Od 20. 10. 2026 (§ 0c) pro JEDNU zakázku objednávky: `production_order_id`
 * v query; bez něj projde jen objednávka s jedinou zakázkou.
 *
 * Autorizace: přihlášený vlastník, nebo podepsaný `?token=`
 * (`lib/made-to-order/customer-access`). Výpočet je stejný jako při skutečném
 * zrušení (`cancelCommissionByCustomer`), takže zobrazené a provedené číslo se
 * nemůžou rozejít.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const order = await loadCustomerOrder(req, req.params.orderId)

  const loaded = await loadClaimProduction(req.scope, order.id, commissionIdFromRequest(req))
  if (!loaded) {
    res.status(200).json({
      is_commission: false,
      can_cancel: false,
      blocked_reason: "K této objednávce není zakázková výroba.",
    })
    return
  }
  const production = requireSingleCommission(loaded, "náhled zrušení zakázky")

  const block = production.block
  const detail = await loadClaimDetailOrder(req.scope, order.id)
  const eligibility = cancellationEligibility({
    stage: block.stage,
    goodsShipped: goodsShipped(order),
  })
  // Zaplaceno ZA TUTO zakázku — dopravu/balné nesené za objednávku vrací jen
  // poslední zbývající položka (stejné pravidlo jako skutečné zrušení).
  const lineItemId: string | null = production.productionOrder.line_item_id ?? null
  const goods = ((detail?.items ?? []) as any[]).filter((item) => item && !isServiceLine(item))
  const otherGoods = lineItemId
    ? goods.filter((item) => item.id !== lineItemId)
    : goods.filter((item) => !isMadeToOrderItem(item))
  const money = commissionMoney(production.productionOrder, production.paymentRequests)
  const paidTotal = commissionRefundablePaid({
    paidRemaining: commissionPaidRemaining(block),
    extrasTotal: money.extras_total,
    extrasOutstanding: money.extras_outstanding,
    lastItemInOrder: otherGoods.length === 0,
  })
  const plan = cancellationPlan({
    productionStartNotifiedAt: block.production_start_notified_at,
    paidTotal,
    depositContract: block.deposit_contract,
    cancelledBy: "customer",
  })
  const line = commissionLineOf(detail, production.productionOrder)

  res.status(200).json({
    is_commission: true,
    production_order_id: production.productionOrder.id,
    line_item_id: lineItemId,
    title: commissionTitleOf(detail, production.productionOrder),
    variant_title: (line?.variant_title as string) ?? null,
    can_cancel: eligibility.can_cancel,
    blocked_reason: eligibility.blocked_reason,
    phase: plan.phase,
    production_start_notified_at: block.production_start_notified_at,
    stage: block.stage,
    currency_code: String(order.currency_code ?? production.productionOrder.currency_code ?? "czk"),
    item_total: money.item_total,
    paid_total: paidTotal,
    deposit_amount: block.deposit_contract,
    deposit_percentage: block.deposit_percentage,
    refund_amount: plan.refund_amount,
    deposit_kept: plan.deposit_kept,
    // Objednávka se po zrušení ruší celá, jen když nezbývá jiná položka.
    last_item_in_order: otherGoods.length === 0,
    // Už zrušená zakázka: jak to dopadlo.
    cancelled_by: block.cancelled_by,
    cancellation_phase: block.cancellation_phase,
    cancellation_refund_amount: block.cancellation_refund_amount,
    cancelled_at: block.cancelled_at,
  })
}
