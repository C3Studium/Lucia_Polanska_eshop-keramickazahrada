import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  buildEditContext,
  cancelCustomerEdit,
  runCustomerEdit,
} from "../../../../../lib/order-edit/core"
import { EditBodySchema } from "../../../../../lib/order-edit/schema"
import { loadOrderByToken } from "../../../../../lib/order-edit/token"
import type { EditAction } from "../../../../../lib/order-edit-rules"

/**
 * Úprava objednávky přes podepsaný token (odkaz z e-mailu i přihlášený
 * zákazník, kterému token vydá `/store/orders/:id/edit`). Jen „dveře" —
 * pravidla, náhled i uložení dělá `lib/order-edit/core.ts`, tvary odpovědí
 * jsou v docs/uprava-objednavky-plan.md §5.
 *
 * Token odemyká JEN přihlášení — žádné pravidlo neobchází. Je to HMAC čísla
 * objednávky: na jinou objednávku nesedí, srovnává se v konstantním čase.
 */

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const order = await loadOrderByToken(req, req.query.token)
  res.status(200).json(await buildEditContext(req.scope, order))
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const parsed = EditBodySchema.safeParse(body)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Neplatný požadavek na úpravu.")
  }
  const order = await loadOrderByToken(req, body.token)
  const result = await runCustomerEdit(req.scope, order, parsed.data.actions as EditAction[], {
    dryRun: parsed.data.dry_run === true,
    requestedBy: order.customer_id ?? null,
  })
  res.status(200).json(result)
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const order = await loadOrderByToken(req, req.query.token)
  await cancelCustomerEdit(req.scope, order.id)
  res.status(200).json({ cancelled: true })
}
