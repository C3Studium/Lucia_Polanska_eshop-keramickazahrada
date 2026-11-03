import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { formatDate, sendCustomerEmail } from "../../../../../lib/customer-email"
import {
  claimEmailBase,
  claimService,
  retrieveClaim,
} from "../../../../../lib/claims/admin"
import { loadClaimEmailContext } from "../../../../../lib/claims/email-copy"

/**
 * POST /admin/return-requests/:id/received — zboží dorazilo zpět / přijato
 * k opravě (docs/reklamace-a-zruseni.md §3–4). `approved → received`.
 *
 * Teprve odsud smí u odstoupení/vrácení jít peníze (§1832/4: prodávající smí
 * s vrácením počkat na zboží). Zákazník dostane „zboží k nám dorazilo" —
 * krátký mezikrok, ať ví, že se zásilka neztratila.
 */

type ReceivedBody = { note?: string | null }

export const POST = async (
  req: MedusaRequest<ReceivedBody>,
  res: MedusaResponse
) => {
  const body = (req.body || {}) as ReceivedBody
  const note = typeof body.note === "string" ? body.note.trim() : ""

  const request = await retrieveClaim(req.scope, req.params.id)
  if (request.status !== "approved") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      request.status === "received"
        ? "Zboží už je označené jako přijaté."
        : request.status === "pending"
          ? "Žádost napřed schvalte — přijetí zboží přichází po rozhodnutí."
          : "Žádost je už uzavřená."
    )
  }

  const now = new Date()
  const updated = await claimService(req.scope).updateReturnRequests({
    id: request.id,
    status: "received",
    goods_received_at: now,
  })

  // Jazyk objednávky (lib/claims/email-copy); poznámka majitelky jde, jak ji napsala.
  const emailContext = await loadClaimEmailContext(req.scope, request.order_id)
  await sendCustomerEmail(req.scope, {
    template: "return-received",
    to: request.email,
    key: `return-received:${request.id}`,
    orderId: request.order_id,
    locale: emailContext.locale,
    data: {
      ...claimEmailBase(updated, updated.protocol_url, emailContext),
      receivedAt: formatDate(now, emailContext.locale),
      ...(note ? { note } : {}),
    },
  })

  res.status(200).json({ return_request: updated })
}
