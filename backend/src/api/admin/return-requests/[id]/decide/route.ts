import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { sendCustomerEmail } from "../../../../../lib/customer-email"
import { getMerchantSettings } from "../../../../../lib/merchant-settings"
import {
  claimEmailBase,
  claimService,
  decisionOutcome,
  regenerateProtocol,
  retrieveClaim,
} from "../../../../../lib/claims/admin"
import {
  RESOLUTIONS,
  type Resolution,
} from "../../../../../lib/claims/constants"

/**
 * POST /admin/return-requests/:id/decide — her one decision on a request
 * (docs/reklamace-a-zruseni.md §4).
 *
 * `approve` u reklamace vyžaduje `resolution` (oprava / výměna / sleva /
 * vrácení peněz — §2169–2172); u odstoupení a vrácení je to vždy vrácení peněz
 * a doplní se samo. `reject` requires a note, because the note *is* the
 * customer-visible reason in „return-rejected" (§19/3 ZOS: zamítnutí písemně
 * odůvodnit). Either way the request leaves the pending queue and cannot be
 * decided twice.
 */

type DecideBody = {
  decision?: "approve" | "reject"
  note?: string | null
  resolution?: string | null
}

/** Lhůta do e-mailu „schváleno" — podle druhu a způsobu vyřízení. */
const deadlineCopy = (kind: string | null, resolution: Resolution): string => {
  if (kind === "reklamace") {
    return "vyřídíme do 30 dnů od uplatnění reklamace"
  }
  return resolution === "discount"
    ? "část ceny vrátíme do 14 dnů"
    : "peníze vrátíme do 14 dnů od přijetí zboží"
}

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
      "Důvod zamítnutí je povinný — zákazník ho uvidí v e-mailu i v protokolu."
    )
  }

  const service = claimService(req.scope)
  const request = await retrieveClaim(req.scope, req.params.id)
  if (request.status !== "pending") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Žádost už byla rozhodnuta."
    )
  }

  // Způsob vyřízení: u reklamace si ho musí vybrat, u odstoupení/vrácení je
  // jediný možný. Zamítnutí žádný nemá.
  let resolution: Resolution | null = null
  if (body.decision === "approve") {
    if (request.kind === "reklamace") {
      if (!(RESOLUTIONS as readonly string[]).includes(body.resolution ?? "")) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "U reklamace zvolte způsob vyřízení — oprava, výměna, sleva, nebo vrácení peněz."
        )
      }
      resolution = body.resolution as Resolution
    } else {
      resolution = "refund"
    }
  }

  const itemsText =
    typeof request.items === "string" && request.items.trim().length
      ? request.items.trim()
      : null

  const decidedAt = new Date()
  const updated = await service.updateReturnRequests({
    id: request.id,
    status: body.decision === "approve" ? "approved" : "rejected",
    decision_note: note || null,
    decided_at: decidedAt,
    resolution,
  })

  // Protokol se dogeneruje s ROZHODNUTÍM (způsob + datum + poznámka). Číslo
  // zůstává; odkaz jde do e-mailu.
  const protocol = await regenerateProtocol(req.scope, updated, {
    outcome: decisionOutcome(updated),
    note: note || null,
    decidedAt,
  })

  if (body.decision === "approve") {
    const settings = await getMerchantSettings(req.scope).catch(() => null)
    const effective = resolution ?? "refund"
    // NOTE: if she ALSO creates a native Medusa return for this order, the
    // `order.return_requested` subscriber sends its own „return-approved"
    // under a different key — it checks for a decided request here and skips.
    await sendCustomerEmail(req.scope, {
      template: "return-approved",
      to: request.email,
      key: `return-approved:req:${request.id}`,
      orderId: request.order_id,
      data: {
        subject:
          request.kind === "reklamace" ? "Reklamace uznána" : "Vrácení schváleno",
        ...claimEmailBase(updated, protocol.url),
        returnReason: request.reason,
        ...(itemsText ? { approvedItems: itemsText } : {}),
        returnMethod: "Zásilka na adresu ateliéru",
        // Zboží se vrací vždy kromě slevy — ta ho nechává u zákazníka.
        goodsReturnRequired: effective !== "discount",
        returnAddress:
          settings?.return_address || "Keramická zahrada\nPutim 229\n397 01 Písek",
        ...(settings?.return_instructions?.trim()
          ? { returnInstructions: settings.return_instructions.trim() }
          : {}),
        returnDeadline: deadlineCopy(request.kind ?? null, effective),
      },
    })
  } else {
    // Only what is real: items only when the customer named them, and the
    // rejection reason is her note, verbatim. ČOI věta je v šabloně natvrdo.
    await sendCustomerEmail(req.scope, {
      template: "return-rejected",
      to: request.email,
      key: `return-rejected:${request.id}`,
      orderId: request.order_id,
      data: {
        subject:
          request.kind === "reklamace"
            ? "Reklamaci nemůžeme uznat"
            : "Žádost o vrácení nemůžeme přijmout",
        ...claimEmailBase(updated, protocol.url),
        rejectionReason: note,
        ...(itemsText ? { rejectedItems: itemsText } : {}),
      },
    })
  }

  res.status(200).json({
    return_request: { ...updated, protocol_url: protocol.url ?? updated.protocol_url },
  })
}
