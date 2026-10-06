import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { signOrderAccessToken } from "../../../../../lib/order-access-link"

/**
 * Podepsaný token pro self-service stránky JEDNÉ objednávky — úprava
 * (`/order/:id/edit`) a reklamace/vrácení/odstoupení (`/order/:id/refund`) —,
 * aby šly otevřít i z potvrzovací stránky hned po objednání, ne jen z e-mailu.
 *
 * Token je HMAC id pod serverovým tajemstvím (viz `lib/order-access-link`);
 * storefront z něj složí relativní odkazy. Stránky i jejich endpointy si token
 * VŽDY ověří znovu (`verifyOrderAccessToken`) a drží se pravidel (úprava jen ve
 * fázi received/working bez expedice; reklamace má svá) — token jen nahrazuje
 * přihlášení, neobchází obchodní logiku.
 *
 * Přístupový model je stejný jako u zbytku objednávky: kdo má (nehádatelné,
 * 122bit ULID) id, tomu potvrzovací stránka i `/progress` už ukazují celý
 * detail. Token proto vydáváme také podle id. Ověříme jen, že objednávka
 * existuje, ať nevydáváme token pro překlep.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id"],
    filters: { id: orderId },
  })

  if (!orders.length) {
    res.status(404).json({ message: "Objednávka nenalezena." })
    return
  }

  res.status(200).json({ token: signOrderAccessToken(orderId) })
}
