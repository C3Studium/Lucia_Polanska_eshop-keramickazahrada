import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  getInternationalShipping,
  internationalCalculator,
  saveInternationalShipping,
  type SaveInternationalInput,
} from "../../../lib/international-shipping"

/**
 * Česká pošta – na adresu zahraničí (Nastavení obchodu › Doprava a platba).
 *
 * GET — nastavení, země z regionů mimo Česko s cenou pro průměrnou váhu.
 *       `?zeme=de&kg=2.5` = malá kalkulačka: všechny služby ČP pro zemi a váhu.
 * POST `{ countries, overrides_czk, service, parcel_weight_kg, packaging_kg }`
 *       — první uložení založí zónu „Zahraničí" i volbu dopravy
 *       (lib/international-shipping.ts).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const zeme = typeof req.query.zeme === "string" ? req.query.zeme : null
  if (zeme) {
    const kg = Number(String(req.query.kg ?? "").replace(",", "."))
    if (!/^[a-z]{2}$/i.test(zeme) || !(kg > 0 && kg <= 30)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Zadejte zemi a váhu od 0,1 do 30 kg.")
    }
    res.json(internationalCalculator(zeme, kg))
    return
  }
  res.json(await getInternationalShipping(req.scope))
}

export const POST = async (req: MedusaRequest<SaveInternationalInput>, res: MedusaResponse) => {
  try {
    res.json(await saveInternationalShipping(req.scope, (req.body ?? {}) as SaveInternationalInput))
  } catch (error) {
    if (error instanceof MedusaError) throw error
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Nastavení se nepodařilo uložit: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
