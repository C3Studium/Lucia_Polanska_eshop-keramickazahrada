import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ensureInvoiceForOrder } from "../../../../../../lib/idoklad-invoice"

/**
 * „Vystavit fakturu" / „Vystavit znovu" on the order-detail widget.
 *
 * Issues the invoice for this order unless one already exists — the same
 * never-twice rule the subscribers follow; re-issuing is only possible after
 * a *failed* attempt, which never stamped an invoice id. The admin button
 * does not gate on payment: clicking it is the merchant's explicit decision.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const result = await ensureInvoiceForOrder(req.scope, req.params.orderId, {
    source: "admin",
  })

  if (result.status === "exists") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Faktura ${result.state?.invoice_number ?? ""} už byla vystavena — dvakrát ji nevystavíme.`.trim()
    )
  }
  if (result.status === "skipped") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      result.reason ?? "Fakturu teď nelze vystavit."
    )
  }
  if (result.status === "failed") {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      result.reason ?? "Vystavení faktury v iDokladu selhalo."
    )
  }

  res.json({ invoice: result.state })
}
