import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { signOrderAccessToken } from "../../../../../lib/order-access-link"
import {
  buildEditContext,
  cancelCustomerEdit,
  loadEditOrder,
  runCustomerEdit,
} from "../../../../../lib/order-edit/core"
import { EditBodySchema } from "../../../../../lib/order-edit/schema"
import type { EditAction } from "../../../../../lib/order-edit-rules"

/**
 * Úprava objednávky přihlášeným zákazníkem (účet). Stejné jádro jako
 * tokenová cesta (`../guest-edit`). GET navíc vrací `access_token`: stránka
 * úpravy pak jede jednou cestou pro hosta i účet (docs/uprava-objednavky-plan.md
 * §5) — token dostane jen ověřený vlastník, je to totéž co odkaz z e-mailu.
 */
const loadOwnOrder = async (req: AuthenticatedMedusaRequest) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Přihlaste se prosím.")
  }
  const order = await loadEditOrder(req.scope, req.params.id)
  if (!order || order.customer_id !== customerId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }
  return order
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const order = await loadOwnOrder(req)
  res.status(200).json({
    ...(await buildEditContext(req.scope, order)),
    access_token: signOrderAccessToken(order.id),
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const parsed = EditBodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Neplatný požadavek na úpravu.")
  }
  const order = await loadOwnOrder(req)
  const result = await runCustomerEdit(req.scope, order, parsed.data.actions as EditAction[], {
    dryRun: parsed.data.dry_run === true,
    requestedBy: req.auth_context?.actor_id ?? null,
  })
  res.status(200).json(result)
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const order = await loadOwnOrder(req)
  await cancelCustomerEdit(req.scope, order.id)
  res.status(200).json({ cancelled: true })
}
