import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  claimService,
  decisionOutcome,
  protocolRefundsOf,
  regenerateProtocol,
  retrieveClaim,
  sendResolvedEmail,
} from "../../../../../lib/claims/admin"
import { isFinalStatus } from "../../../../../lib/claims/constants"
import { loadMoneyOrder } from "../../../../../lib/claims/money"

/**
 * POST /admin/return-requests/:id/resolve — „Vyřízeno" bez dalších peněz
 * (docs/reklamace-a-zruseni.md §3–4): oprava hotová, výměna odeslaná, nebo se
 * prostě nic nevrací. Z `approved` i `received` → `resolved`.
 *
 * Protokol se přegeneruje jako „potvrzení o vyřízení" (§19/3 ZOS: datum a
 * způsob) a zákazník dostane `return-resolved`. Když už se u žádosti nějaké
 * peníze vrátily (částečně), jsou v potvrzení taky.
 */

type ResolveBody = { note?: string | null }

export const POST = async (
  req: MedusaRequest<ResolveBody>,
  res: MedusaResponse
) => {
  const body = (req.body || {}) as ResolveBody
  const note = typeof body.note === "string" ? body.note.trim() : ""

  const request = await retrieveClaim(req.scope, req.params.id)
  if (isFinalStatus(request.status)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Žádost je už uzavřená.")
  }
  if (request.status === "pending") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Žádost napřed schvalte, nebo zamítněte — vyřízení přichází po rozhodnutí."
    )
  }

  const now = new Date()
  const updated = await claimService(req.scope).updateReturnRequests({
    id: request.id,
    status: "resolved",
    resolved_at: now,
    resolution_note: note || request.resolution_note || null,
    // Starý řádek bez rozhodnutí: odstoupení/vrácení je vždy vrácení peněz.
    resolution:
      request.resolution ?? (request.kind === "reklamace" ? null : "refund"),
  })

  // Měna pro řádky refundací v potvrzení — z objednávky; bez ní CZK.
  const order = await loadMoneyOrder(req.scope, request.order_id).catch(() => null)
  const currency = order?.currency_code ?? "czk"

  const protocol = await regenerateProtocol(req.scope, updated, {
    outcome: decisionOutcome(updated),
    note: updated.resolution_note ?? null,
    decidedAt: now,
    confirmation: true,
    refunds: protocolRefundsOf(updated, currency),
  })

  await sendResolvedEmail(req.scope, updated, {
    protocolUrl: protocol.url,
    currency,
    note: updated.resolution_note ?? null,
  })

  res.status(200).json({
    return_request: { ...updated, protocol_url: protocol.url ?? updated.protocol_url },
  })
}
