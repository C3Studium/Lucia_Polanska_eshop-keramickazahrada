import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { loadCustomerOrder } from "../../../../../lib/made-to-order/customer-access"
import { cancelCommissionByCustomer } from "../../../../../lib/made-to-order/customer-cancel"

type CancelBody = {
  /** Výslovné potvrzení — storefront ho pošle až po zobrazení důsledků (Z4/Z5). */
  confirm?: boolean
  reason?: string | null
  /** Podepsaný token objednávky (host bez přihlášení) — alternativa k `?token=`. */
  token?: string
}

/**
 * `POST /store/made-to-order/:orderId/cancel` — zákazník ruší zakázku
 * (LEGAL_AUDIT.md § 0, Z4/Z5). Tělo `{ confirm: true, reason? }`.
 *
 * Server provede celé zrušení sám (`lib/made-to-order/customer-cancel`): žádost
 * v Reklamace a zrušení vyřízená automaticky, refund stejnou cestou (vše před
 * e-mailem Z3, nad zálohu po něm), uzavření výroby a objednávky, jeden e-mail
 * zákazníkovi a upozornění majitelce. Druhé volání vrátí 409 (zakázka je už
 * zrušená / žádost běží). Autorizace jako u `cancellation`.
 */
export const POST = async (req: MedusaRequest<CancelBody>, res: MedusaResponse) => {
  const body = (req.body ?? {}) as CancelBody
  if (body.confirm !== true) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Zrušení zakázky je potřeba potvrdit (confirm: true) — až po přečtení, co se vrátí."
    )
  }
  const order = await loadCustomerOrder(req, req.params.orderId)

  const result = await cancelCommissionByCustomer(req.scope, {
    orderId: order.id,
    reason: typeof body.reason === "string" ? body.reason.slice(0, 2000) : null,
    trigger: "customer",
  })

  res.status(200).json({
    cancelled: true,
    phase: result.phase,
    currency_code: result.currency_code,
    paid_total: result.paid_total,
    refund_amount: result.refund_amount,
    deposit_kept: result.deposit_kept,
    deposit_amount: result.deposit_amount,
    deposit_percentage: result.deposit_percentage,
    refund_method: result.refund_method,
    protocol_url: result.protocol_url,
    request_id: result.request_id,
    message:
      result.phase === "before_production"
        ? result.refund_amount > 0
          ? "Zakázka je zrušená. Vše, co jste zaplatili, vrátíme do 14 dnů stejnou cestou."
          : "Zakázka je zrušená. Nebylo nic zaplaceno — není co vracet."
        : result.refund_amount > 0
          ? "Zakázka je zrušená. Záloha se po zahájení výroby nevrací; částku nad zálohu vrátíme do 14 dnů stejnou cestou."
          : "Zakázka je zrušená. Záloha se po zahájení výroby nevrací; nad zálohu nebylo zaplaceno nic.",
  })
}
