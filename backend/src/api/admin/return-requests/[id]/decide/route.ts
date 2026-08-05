import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { orderLink, sendCustomerEmail } from "../../../../../lib/customer-email"
import { RETURN_REQUEST_MODULE } from "../../../../../modules/return-request"
import type ReturnRequestModuleService from "../../../../../modules/return-request/service"

/**
 * POST /admin/return-requests/:id/decide — her one decision on a request.
 *
 * `approve` sends „return-approved" with the atelier's return address;
 * `reject` requires a note, because the note *is* the customer-visible reason
 * in „return-rejected". Either way the request leaves the pending queue and
 * cannot be decided twice.
 */

type DecideBody = {
  decision?: "approve" | "reject"
  note?: string | null
}

const RETURN_ADDRESS = "Keramická zahrada, Putim 229, 397 01 Písek"

export const POST = async (
  req: MedusaRequest<DecideBody>,
  res: MedusaResponse
) => {
  const body = (req.body || {}) as DecideBody
  if (body.decision !== "approve" && body.decision !== "reject") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Neplatné rozhodnutí — očekává se „approve“, nebo „reject“."
    )
  }
  const note = typeof body.note === "string" ? body.note.trim() : ""
  if (body.decision === "reject" && !note) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Důvod zamítnutí je povinný — zákazník ho uvidí v e-mailu."
    )
  }

  const service = req.scope.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )

  let request: any
  try {
    request = await service.retrieveReturnRequest(req.params.id)
  } catch {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Žádost o vrácení nebyla nalezena."
    )
  }
  if (request.status !== "pending") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Žádost už byla rozhodnuta."
    )
  }

  const itemsText =
    typeof request.items === "string" && request.items.trim().length
      ? request.items.trim()
      : null
  // Real link or nothing — the templates fall back to a sensible default and
  // an empty href would be worse than that.
  const link = orderLink({ id: request.order_id })

  const updated = await service.updateReturnRequests({
    id: request.id,
    status: body.decision === "approve" ? "approved" : "rejected",
    decision_note: note || null,
    decided_at: new Date(),
  })

  if (body.decision === "approve") {
    // NOTE: if she ALSO creates a native Medusa return for this order, the
    // `order.return_requested` subscriber sends its own „return-approved"
    // under a different key (`return-approved:{return_id}`), so the customer
    // would get the mail twice. The „Vrácení" page copy tells her it is one
    // or the other — this key (`return-approved:req:{id}`) only dedupes
    // re-sends of *this* decision.
    await sendCustomerEmail(req.scope, {
      template: "return-approved",
      to: request.email,
      key: `return-approved:req:${request.id}`,
      orderId: request.order_id,
      data: {
        ...(request.customer_name
          ? { customerName: request.customer_name }
          : {}),
        orderNumber: `#${request.order_display_id}`,
        returnReason: request.reason,
        returnMethod: "Zásilka na adresu ateliéru",
        returnAddress: RETURN_ADDRESS,
        ...(link ? { orderLink: link } : {}),
      },
    })
  } else {
    // Only what is real: no returnNumber (no native return exists), items only
    // when the customer named them, and the rejection reason is her note,
    // verbatim.
    await sendCustomerEmail(req.scope, {
      template: "return-rejected",
      to: request.email,
      key: `return-rejected:${request.id}`,
      orderId: request.order_id,
      data: {
        ...(request.customer_name
          ? { customerName: request.customer_name }
          : {}),
        orderNumber: `#${request.order_display_id}`,
        rejectionReason: note,
        ...(itemsText ? { rejectedItems: itemsText } : {}),
        ...(link ? { orderLink: link } : {}),
      },
    })
  }

  res.status(200).json({ return_request: updated })
}
