import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { claimService, retrieveClaim } from "../../../../../../../lib/claims/admin"
import { kindLabel } from "../../../../../../../lib/claims/constants"
import { loadMoneyOrder } from "../../../../../../../lib/claims/money"
import { issueCreditNoteForRefund } from "../../../../../../../lib/idoklad-invoice"

/**
 * POST /admin/return-requests/:id/refunds/:refundId/credit-note — vystavit
 * dobropis k už provedené refundaci znovu.
 *
 * Proč: dobropis je best-effort až PO vrácení peněz (ComGate už vrátil, to
 * nejde vzít zpět). Když iDoklad odmítne (změřeno 10. 10. 2026 na #38:
 * chybělo povinné `CreditNoteReason`) nebo je zrovna nedostupný, peníze jsou
 * venku a doklad chybí — tahle akce ho dovystaví z téhož košíku. Idempotentní
 * přes `order.metadata.idoklad_credit_notes[].refund_id` (podruhé vrátí
 * „exists").
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const request = await retrieveClaim(req.scope, req.params.id)
  const refunds = (Array.isArray(request.refunds) ? request.refunds : []) as any[]
  const refund = refunds.find((entry) => entry?.id === req.params.refundId)
  if (!refund) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Refundace s tímhle id u žádosti není."
    )
  }
  if (refund.credit_note?.status === "issued" || refund.credit_note?.status === "exists") {
    res.status(200).json({
      credit_note: refund.credit_note,
      message: `Dobropis ${refund.credit_note.number ?? ""} už existuje.`,
    })
    return
  }

  const order = await loadMoneyOrder(req.scope, request.order_id)
  if (!order) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka k této žádosti nebyla nalezena."
    )
  }

  const creditNote = await issueCreditNoteForRefund(req.scope, order, {
    id: String(refund.id),
    amount: Number(refund.amount) || 0,
    lines: Array.isArray(refund.lines) ? refund.lines : null,
    currency: String(order.currency_code ?? refund.currency_code ?? "czk"),
    reason: kindLabel(request.kind),
  } as never).catch((error) => ({
    status: "error" as const,
    reason: error instanceof Error ? error.message : "neznámá chyba",
  }))

  await claimService(req.scope).updateReturnRequests({
    id: request.id,
    refunds: refunds.map((entry) =>
      entry?.id === refund.id ? { ...entry, credit_note: creditNote } : entry
    ) as unknown as Record<string, unknown>,
  })

  const status = (creditNote as any).status
  const message =
    status === "issued"
      ? `Dobropis ${(creditNote as any).number ?? ""} vystaven.`
      : status === "exists"
        ? "Dobropis už byl vystaven."
        : status === "skipped"
          ? `Dobropis se nevystavil: ${(creditNote as any).reason ?? ""}`
          : `Dobropis se nepodařilo vystavit — ${(creditNote as any).reason ?? "neznámá chyba"}`

  res.status(status === "error" ? 502 : 200).json({ credit_note: creditNote, message })
}
