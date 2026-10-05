import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reconcileOrderBalance } from "../../../../../lib/balance-payment"

/**
 * „Dokončovací" krok doplatku po návratu z ComGate — to, co doplatku chybělo.
 *
 * Záloha se v checkoutu po návratu dokončí (dotvoří objednávku). Doplatek žádný
 * takový krok neměl: po zaplacení se jen zobrazila stránka a čekalo se na webhook
 * (vyžaduje notif. URL v portálu) nebo 30min job → zákazník neviděl zaplaceno,
 * nepřišla faktura a stránka ukazovala starý stav. Tahle route to dorovná hned:
 * zeptá se brány na stav a při zaplacení označí doplatek, zaúčtuje a pošle
 * potvrzení + fakturu. Idempotentní (viz `reconcileOrderBalance`), takže pozdní
 * webhook/job nic nezdvojí. Gated přes id objednávky (publishable key, bez
 * přihlášení) — stejně jako ostatní `/store/made-to-order` routy.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const result = await reconcileOrderBalance(req.scope, req.params.orderId)
  res.status(200).json(result)
}
