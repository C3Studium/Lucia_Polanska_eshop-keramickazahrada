import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getMerchantSettings } from "../../../lib/merchant-settings"

/**
 * Read access to the shop-global merchant settings (WorkflowPlan.md A3).
 *
 * Admin pages need a few of these to say anything true — the low-stock page has
 * to name the threshold it warns at, the onboarding cards need to know which
 * ones were dismissed. Everything goes through the single typed accessor, so
 * this route never learns where the values are stored and cannot widen the
 * closed key allowlist.
 *
 * Writing is deliberately not exposed yet: the first thing that edits a setting
 * is the „Hranice upozornění" drawer in P7-1, and it will add the write route
 * with the validation that belongs to it.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const settings = await getMerchantSettings(req.scope)

  res.status(200).json({ settings })
}
