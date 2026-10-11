import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  orderClaimsUrl,
  orderEditUrl,
  orderRefundUrl,
  signOrderAccessToken,
} from "../../../../../lib/order-access-link"

/**
 * Odkazy zákaznické samoobsluhy k objednávce — tytéž, které chodí v e-mailech
 * (úprava, reklamace a zrušení, stav žádostí). Pro majitelku, když zákazník
 * e-mail nemá po ruce („pošlete mi odkaz znovu"), a pro ověřování úpravy
 * objednávky přes API (docs/uprava-objednavky-plan.md, sekce Ověřeno).
 *
 * Jen pro přihlášeného admina (middlewares.ts) — token je totéž co odkaz
 * z e-mailu, zákazníkovi ho dává obchod sám.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.orderId
  res.status(200).json({
    token: signOrderAccessToken(orderId),
    edit_url: orderEditUrl(orderId) || null,
    refund_url: orderRefundUrl(orderId) || null,
    claims_url: orderClaimsUrl(orderId) || null,
  })
}
