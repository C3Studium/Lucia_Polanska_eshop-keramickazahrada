import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { verifyOrderAccessToken } from "../../../../../lib/order-access-link"
import { orderDocuments } from "../../../../../lib/order-documents"

/**
 * Dokumenty objednávky ke stažení — stránka potvrzené objednávky
 * (lib/order-documents.ts: potvrzení, faktury, dobropisy, podmínky, poučení,
 * protokol glazury).
 *
 * Přístup jako u `/progress`: přihlášený zákazník, kterému objednávka patří,
 * nebo host s PODEPSANÝM tokenem objednávky (`?token=`). Cizí objednávka =
 * 404, ne 403 — neprozradit, že takové id existuje. Faktura nese jméno
 * a adresu, takže holé id objednávky nestačí.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id
  const customerId = req.auth_context?.actor_id
  const token = typeof req.query.token === "string" ? req.query.token : ""
  const tokenOk = Boolean(token) && verifyOrderAccessToken(orderId, token)
  if (!customerId && !tokenOk) {
    res.status(401).json({ message: "Přihlaste se prosím." })
    return
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ["id", "customer_id"], filters: { id: orderId } })
  const order = (data as any[])[0]
  if (!order || (!tokenOk && order.customer_id !== customerId)) {
    res.status(404).json({ message: "Objednávka nebyla nalezena." })
    return
  }
  res.json({ documents: await orderDocuments(req.scope, orderId) })
}
