import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { comgateJeZkusebni, jeZkusebniRezim } from "../../../../lib/test-mode"

/**
 * Co o zkušebním režimu platí právě teď.
 *
 * ## Proč vlastní routa, když nastavení má svou
 *
 * `/admin/merchant-settings` vrací, co je **uložené**. Tahle stránka musí
 * ukázat, co **platí** — a to jsou u ComGate a iDokladu proměnné prostředí,
 * které v nastavení nejsou a být nemají. Bez nich by stránka tvrdila
 * „zkušební režim vypnutý" i ve chvíli, kdy ComGate běží nanečisto, protože
 * to má někdo od loňska v proměnné.
 *
 * Vrací se jen ano/ne, žádné klíče ani tajemství.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const zkusebni = await jeZkusebniRezim(req.scope)

  res.json({
    /** Uložený přepínač — ovládá iDoklad. */
    test_mode_enabled: zkusebni,
    /** Skutečnost z prostředí, ne přání. */
    comgate_test: comgateJeZkusebni(),
    /** Má obchod iDoklad vůbec nastavený? */
    idoklad_configured: Boolean(
      process.env.IDOKLAD_CLIENT_ID && process.env.IDOKLAD_CLIENT_SECRET
    ),
    /** Vystavují se teď faktury? */
    idoklad_active:
      !zkusebni &&
      Boolean(process.env.IDOKLAD_CLIENT_ID && process.env.IDOKLAD_CLIENT_SECRET),
  })
}
