import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"
import { outstandingFor } from "../../../../../lib/balance-payment"
import { balancePaymentUrl } from "../../../../../lib/balance-payment-link"

/**
 * Stav doplatku zakázky pro stránku potvrzení objednávky.
 *
 * Doplatek žije v modulu zakázky, ne v nativní ceně objednávky (ta po zaplacení
 * zálohy vypadá „zaplaceno"). Souhrn na potvrzení proto nemůže rozpoznat „jen
 * záloha" z objednávky samotné — vezme to odsud: kolik je zaplaceno zálohou,
 * kolik zbývá doplatit, a podepsaný odkaz na doplacení (funguje i bez přihlášení).
 *
 * `is_commission: false` = není to zakázka → Souhrn se chová jako u běžné
 * objednávky.
 */
const toNumber = (value: unknown): number => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const [productionOrder] = (await madeToOrder.listProductionOrders({
    order_id: req.params.orderId,
  } as never)) as any[]

  if (!productionOrder) {
    res.status(200).json({ is_commission: false })
    return
  }

  const requests = (await madeToOrder.listProductionPaymentRequests({
    production_order_id: productionOrder.id,
  } as never)) as any[]

  const outstanding = outstandingFor(productionOrder, requests)
  const depositPaid = requests
    .filter((r) => r.type === "deposit" && r.status === "paid")
    .reduce((sum, r) => sum + toNumber(r.amount), 0)
  const balancePaid = requests
    .filter((r) => r.type === "balance" && r.status === "paid")
    .reduce((sum, r) => sum + toNumber(r.amount), 0)

  res.status(200).json({
    is_commission: true,
    stage: productionOrder.stage,
    currency_code: String(productionOrder.currency_code || "czk"),
    deposit_paid: depositPaid,
    balance_paid: balancePaid,
    outstanding,
    // Podepsaný odkaz (funguje i bez přihlášení) — jen když je co doplácet a
    // zakázka není ve finále.
    pay_url:
      outstanding > 0.005 &&
      !["cancelled", "completed"].includes(productionOrder.stage)
        ? balancePaymentUrl(req.params.orderId)
        : null,
  })
}
