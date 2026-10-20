import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"
import { outstandingFor } from "../../../../../lib/balance-payment"
import {
  balancePaymentUrl,
  signBalanceToken,
} from "../../../../../lib/balance-payment-link"
import { isMadeToOrderItem } from "../../../../../lib/claims/made-to-order"
import { contractDepositAmountOf } from "../../../../../lib/made-to-order/contract-deposit"
import { toNumber } from "../../../../../lib/order-quantity"

/**
 * Stav doplatku zakázky pro stránku potvrzení objednávky.
 *
 * Doplatek žije v modulu zakázky, ne v nativní ceně objednávky (ta po zaplacení
 * zálohy vypadá „zaplaceno"). Souhrn na potvrzení proto nemůže rozpoznat „jen
 * záloha" z objednávky samotné — vezme to odsud: kolik je zaplaceno zálohou,
 * kolik zbývá doplatit, a podepsaný odkaz na doplacení (funguje i bez přihlášení).
 *
 * Od 20. 10. 2026 (LEGAL_AUDIT.md § 0) navíc SMLUVNÍ záloha (`deposit_amount`,
 * `deposit_percentage` — to, co se po zahájení výroby nevrací; ≠ zaplaceno),
 * kdy odešel e-mail Z3, jak zakázka případně skončila (kdo, fáze, vráceno),
 * PDF „Potvrzení zakázky" (Z11) a lhůta výroby ve dnech (Z9).
 *
 * `is_commission: false` = není to zakázka → Souhrn se chová jako u běžné
 * objednávky.
 */

/**
 * `production_time_max_days` prvního zakázkového řádku: přebití provedení,
 * jinak profil produktu. Null, když se nedá zjistit — nic se nevymýšlí.
 */
const productionTimeMaxDays = async (
  req: MedusaRequest,
  madeToOrder: MadeToOrderModuleService
): Promise<number | null> => {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "items.id",
        "items.product_id",
        "items.variant_id",
        "items.metadata",
        "items.product.metadata",
        "items.product.categories.handle",
      ],
      filters: { id: req.params.orderId },
    })
    const items = ((orders[0] as any)?.items ?? []) as any[]
    const line = items.find((item) => isMadeToOrderItem(item)) ?? items[0]
    if (!line?.product_id) return null

    const [overrides, profiles] = await Promise.all([
      line.variant_id
        ? madeToOrder.listVariantProductionProfiles({ variant_id: line.variant_id })
        : Promise.resolve([] as any[]),
      madeToOrder.listProductProductionProfiles({ product_id: line.product_id }),
    ])
    const days = Number(
      (overrides as any[])[0]?.production_time_max_days_override ??
        (profiles as any[])[0]?.production_time_max_days
    )
    return Number.isFinite(days) && days > 0 ? Math.round(days) : null
  } catch {
    return null
  }
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

  // Podepsaný odkaz na doplacení — jen když je co doplácet a zakázka není ve
  // finále. `balancePaymentUrl` čte base z env (BACKEND_PUBLIC_URL/MEDUSA_BACKEND_URL);
  // když nejsou nastavené, vrací null a tlačítko by zmizelo — proto fallback na
  // host z requestu, ať je odkaz vždy.
  const canPay =
    outstanding > 0.005 &&
    !["cancelled", "completed"].includes(productionOrder.stage)
  let payUrl: string | null = null
  if (canPay) {
    payUrl = balancePaymentUrl(req.params.orderId)
    if (!payUrl) {
      const proto =
        (req.headers["x-forwarded-proto"] as string | undefined) || "https"
      const host =
        (req.headers["x-forwarded-host"] as string | undefined) ||
        (req.headers.host as string | undefined) ||
        ""
      if (host) {
        payUrl = `${proto}://${host}/made-to-order/${
          req.params.orderId
        }/pay-balance?token=${signBalanceToken(req.params.orderId)}`
      }
    }
  }

  const iso = (value: unknown): string | null => {
    if (!value) return null
    const date = new Date(value as string)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  res.status(200).json({
    is_commission: true,
    stage: productionOrder.stage,
    currency_code: String(productionOrder.currency_code || "czk"),
    deposit_paid: depositPaid,
    balance_paid: balancePaid,
    outstanding,
    pay_url: payUrl,
    // Smluvní záloha (Z2/Z5) — nevratná část po zahájení výroby.
    deposit_amount: contractDepositAmountOf(productionOrder),
    deposit_percentage: toNumber(productionOrder.deposit_percentage),
    // Z3: od tohoto okamžiku je zrušení „po zahájení výroby".
    production_start_notified_at: iso(productionOrder.production_start_notified_at),
    // Zrušená zakázka: kdo, fáze, vráceno.
    cancelled_by: productionOrder.cancelled_by ?? null,
    cancellation_phase: productionOrder.cancellation_phase ?? null,
    cancellation_refund_amount:
      productionOrder.cancellation_refund_amount === null ||
      productionOrder.cancellation_refund_amount === undefined
        ? null
        : toNumber(productionOrder.cancellation_refund_amount),
    // Z11: PDF „Potvrzení zakázky" — plní subscriber PDF agenta.
    confirmation_pdf_url: productionOrder.confirmation_pdf_url ?? null,
    confirmation_sent_at: iso(productionOrder.confirmation_sent_at),
    // Z9: lhůta výroby od zahájení (profil / přebití prvního zakázkového řádku).
    production_time_max_days: await productionTimeMaxDays(req, madeToOrder),
  })
}
