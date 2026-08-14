import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  invoiceStateOf,
  isDobirkaOrder,
  isFullyCaptured,
  loadInvoiceOrder,
  resolveIdokladService,
} from "../../../../../lib/idoklad-invoice"

/**
 * What the order-detail invoice widget renders: whether iDoklad is configured
 * at all, and the `order.metadata.idoklad_*` state of this order.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const order = await loadInvoiceOrder(req.scope, req.params.orderId)
  if (!order) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka nebyla nalezena."
    )
  }

  const idoklad = resolveIdokladService(req.scope)

  res.json({
    configured: Boolean(idoklad),
    test_mode: idoklad?.testMode ?? false,
    invoice: invoiceStateOf(order),
    dobirka: isDobirkaOrder(order),
    fully_captured: isFullyCaptured(order),
  })
}
