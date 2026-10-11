import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { verifyOrderAccessToken } from "../order-access-link"
import { loadEditOrder } from "./core"

/**
 * Dveřník tokenové úpravy: podepsaný token z odkazu (nebo vydaný vlastníkovi
 * přes `/store/orders/:id/edit`) → objednávka. Neplatný token = 401, chybějící
 * objednávka = 404. Bez kontroly vlastníka — host přihlášený není.
 */
export const loadOrderByToken = async (req: MedusaRequest, token: unknown) => {
  if (!verifyOrderAccessToken(req.params.id, token)) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Odkaz je neplatný nebo vypršel. Otevřete prosím ten z posledního e-mailu, nebo se nám ozvěte."
    )
  }
  const order = await loadEditOrder(req.scope, req.params.id)
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }
  return order
}
