import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getMerchantSettings,
  isVacationActive,
} from "../../../lib/merchant-settings"

/**
 * The shop's own voice — public, tiny, cache-friendly.
 *
 * The storefront asks this once per page load and renders the banner when
 * the owner is away. Dovolená je jen upozornění — objednávky ani zakázky
 * neblokuje (14. 10. 2026) a po dni návratu se sama přestane hlásit.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const settings = await getMerchantSettings(req.scope).catch(() => null)

  const vacation = isVacationActive(settings)
  res.status(200).json({
    vacation: vacation
      ? {
          until: settings?.vacation_until || null,
          message:
            settings?.vacation_message?.trim() ||
            "Mám dovolenou — objednávky přijímám dál a vyřídím je po návratu.",
        }
      : null,
    announcement:
      settings?.announcement_enabled && settings?.announcement_text?.trim()
        ? {
            message: settings.announcement_text.trim(),
            link: settings.announcement_link?.trim() || null,
          }
        : null,
    // Zakázky se při dovolené už nepozastavují — pole zůstává kvůli starším
    // buildům storefrontu, vždy false.
    commissions_paused: false,
    // Doběrečné — the checkout shows the surcharge next to the dobírka
    // option before it is chosen. Display only: the fee itself is added
    // server-side when the payment session is created (`lib/dobirka-fee.ts`).
    dobirka_fee_czk: settings?.dobirka_fee_czk ?? 39,
  })
}
