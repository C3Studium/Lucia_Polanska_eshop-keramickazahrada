import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getMerchantSettings,
  setMerchantSettings,
} from "../../../lib/merchant-settings"

/**
 * Read access to the shop-global merchant settings (WorkflowPlan.md A3).
 *
 * Admin pages need a few of these to say anything true — the low-stock page has
 * to name the threshold it warns at, the onboarding cards need to know which
 * ones were dismissed. Everything goes through the single typed accessor, so
 * this route never learns where the values are stored and cannot widen the
 * closed key allowlist.
 *
 * `POST` accepts a partial update. Validation is entirely the accessor's: it
 * rejects unknown keys and out-of-range values against the closed A3 allowlist,
 * so this route cannot widen what is storable no matter what is sent to it.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const settings = await getMerchantSettings(req.scope)

  res.status(200).json({ settings })
}

export const POST = async (
  req: MedusaRequest<Record<string, unknown>>,
  res: MedusaResponse
) => {
  // No zod schema here on purpose — `setMerchantSettings` validates against the
  // one closed allowlist in `lib/merchant-settings.ts`. A second schema would be
  // a second place to keep in sync, and A3 exists to prevent exactly that.
  const settings = await setMerchantSettings(req.scope, req.body ?? {})

  res.status(200).json({ settings })
}
