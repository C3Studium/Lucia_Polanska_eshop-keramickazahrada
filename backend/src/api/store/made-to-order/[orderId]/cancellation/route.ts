import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadCustomerOrder } from "../../../../../lib/made-to-order/customer-access"
import {
  cancellationEligibility,
  cancellationPlan,
} from "../../../../../lib/made-to-order/cancellation"
import { goodsShipped } from "../../../../../lib/claims/money"
import {
  commissionPaidRemaining,
  loadClaimProduction,
} from "../../../../../lib/claims/production"

/**
 * `GET /store/made-to-order/:orderId/cancellation` — co se stane, když zákazník
 * zakázku zruší TEĎ (LEGAL_AUDIT.md § 0, Z4/Z5): fáze podle e-mailu Z3, kolik
 * se vrátí a kolik zůstává jako záloha. Storefront podle toho kreslí tlačítko
 * „Zrušit zakázku" a větu „vrátíme vše" / „záloha se nevrací, vrátíme …".
 *
 * Autorizace: přihlášený vlastník, nebo podepsaný `?token=`
 * (`lib/made-to-order/customer-access`). Výpočet je stejný jako při skutečném
 * zrušení (`cancellationPlan`), takže zobrazené a provedené číslo se nemůžou rozejít.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const order = await loadCustomerOrder(req, req.params.orderId)

  const production = await loadClaimProduction(req.scope, order.id)
  if (!production) {
    res.status(200).json({
      is_commission: false,
      can_cancel: false,
      blocked_reason: "K této objednávce není zakázková výroba.",
    })
    return
  }

  const block = production.block
  const eligibility = cancellationEligibility({
    stage: block.stage,
    goodsShipped: goodsShipped(order),
  })
  const paidTotal = commissionPaidRemaining(block)
  const plan = cancellationPlan({
    productionStartNotifiedAt: block.production_start_notified_at,
    paidTotal,
    depositContract: block.deposit_contract,
    cancelledBy: "customer",
  })

  res.status(200).json({
    is_commission: true,
    can_cancel: eligibility.can_cancel,
    blocked_reason: eligibility.blocked_reason,
    phase: plan.phase,
    production_start_notified_at: block.production_start_notified_at,
    stage: block.stage,
    currency_code: String(order.currency_code ?? production.productionOrder.currency_code ?? "czk"),
    paid_total: paidTotal,
    deposit_amount: block.deposit_contract,
    deposit_percentage: block.deposit_percentage,
    refund_amount: plan.refund_amount,
    deposit_kept: plan.deposit_kept,
    // Už zrušená zakázka: jak to dopadlo.
    cancelled_by: block.cancelled_by,
    cancellation_phase: block.cancellation_phase,
    cancellation_refund_amount: block.cancellation_refund_amount,
    cancelled_at: block.cancelled_at,
  })
}
