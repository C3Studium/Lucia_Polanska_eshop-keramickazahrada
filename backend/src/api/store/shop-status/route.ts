import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getMerchantSettings } from "../../../lib/merchant-settings"

/**
 * The shop's own voice — public, tiny, cache-friendly.
 *
 * The storefront asks this once per page load and renders the banner when
 * the owner is away. Enforcement does NOT live here: new commissions are
 * refused server-side in the payment workflow, so this route can be ignored
 * and the rule still holds — display and law are separate layers.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const settings = await getMerchantSettings(req.scope).catch(() => null)

  const vacation = Boolean(settings?.vacation_enabled)
  res.status(200).json({
    vacation: vacation
      ? {
          until: settings?.vacation_until || null,
          message:
            settings?.vacation_message?.trim() ||
            "Dílna má právě přestávku — zakázky přijmeme, až se vrátím.",
        }
      : null,
    announcement:
      settings?.announcement_enabled && settings?.announcement_text?.trim()
        ? {
            message: settings.announcement_text.trim(),
            link: settings.announcement_link?.trim() || null,
          }
        : null,
    commissions_paused: vacation,
    // Doběrečné — the checkout shows the surcharge next to the dobírka
    // option before it is chosen. Display only: the fee itself is added
    // server-side when the payment session is created (`lib/dobirka-fee.ts`).
    dobirka_fee_czk: settings?.dobirka_fee_czk ?? 39,
  })
}
