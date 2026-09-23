import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { captureDobirkaPayment } from "../../../../../lib/dobirka-capture"

/**
 * „Peníze přišly (dobírka)" — the manual, day-one way to record that Česká
 * pošta settled the collected money.
 *
 * Takes no body on purpose: full amount only. A partial dobírka settlement is
 * not a thing the carrier does, and an amount field would only invite typos
 * into the ledger. Idempotent — the second click is a friendly no-op, not an
 * error. The iDoklad webhook (`/hooks/idoklad`) automates the same call.
 *
 * Capturing runs Medusa's native payment workflow, so everything downstream
 * (payment status, statistics, the `payment.captured` subscriber that records
 * the invoice as paid in iDoklad) follows without knowing this button exists.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const capturedBy = (req as any).auth_context?.actor_id || null

  const result = await captureDobirkaPayment(req.scope, req.params.orderId, {
    capturedBy,
  })

  if (result.outcome === "not_found") {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka nebyla nalezena."
    )
  }

  if (result.outcome === "not_dobirka") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Tato objednávka není na dobírku — peníze se zapisují jen u dobírkových objednávek."
    )
  }

  if (result.outcome === "already") {
    res.status(200).json({
      captured: false,
      message: "Peníze u této objednávky už jsou zapsané.",
    })
    return
  }

  res.status(200).json({ captured: true })
}
