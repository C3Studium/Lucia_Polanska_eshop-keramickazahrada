import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { claimService, retrieveClaim } from "../../../../../lib/claims/admin"
import { parseRefundAccount } from "../../../../../lib/claims/refund-account"

/**
 * POST /admin/return-requests/:id/refund-account `{ account }` — majitelka
 * doplní / opraví účet pro vrácení převodem (zákazník ho poslal e-mailem,
 * nebo ho ve formuláři nevyplnil). Stejná kontrola jako ve formuláři
 * (`parseRefundAccount`: český účet s modulo 11, nebo IBAN). Prázdný řetězec
 * účet smaže.
 */

type Body = { account?: string | null }

export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  const body = (req.body || {}) as Body
  const request = await retrieveClaim(req.scope, req.params.id)

  const raw = typeof body.account === "string" ? body.account : ""
  const verdict = parseRefundAccount(raw)
  if (verdict && verdict.ok === false) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, verdict.message)
  }
  // `=== false` výš: bez strictNullChecks TS discriminant pravdivostí nezúží.
  const display = verdict && verdict.ok === true ? verdict.account.display : null

  const updated = await claimService(req.scope).updateReturnRequests({
    id: request.id,
    refund_account: display,
  })

  res.status(200).json({
    return_request: updated,
    message: display ? `Účet pro vrácení uložen: ${display}.` : "Účet pro vrácení smazán.",
  })
}
