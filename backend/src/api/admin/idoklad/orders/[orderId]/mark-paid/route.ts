import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { markInvoicePaidForOrder } from "../../../../../../lib/idoklad-invoice"

/**
 * „Označit jako uhrazenou" on the order-detail widget — records today's date
 * as the payment date in iDoklad. The automatic path is `payment.captured`;
 * this button exists for the odd case the merchant settles by hand.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const result = await markInvoicePaidForOrder(req.scope, req.params.orderId)

  if (result.status === "skipped") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      result.reason ?? "Úhradu teď nelze zapsat."
    )
  }
  if (result.status === "failed") {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      result.reason ?? "Zápis úhrady v iDokladu selhal."
    )
  }

  // `exists` (already recorded) and `paid` both leave the invoice paid.
  res.json({ invoice: result.state })
}
