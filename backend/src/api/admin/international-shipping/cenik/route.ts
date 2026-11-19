import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cenikSeStahuje, obnovCenikCp } from "../../../../lib/international-shipping"

/**
 * Ceník ČP do zahraničí — ruční stažení z kalkulačky postaonline.cz
 * (Nastavení obchodu › Doprava a platba › „Stáhnout ceník teď").
 *
 * GET  — `{ bezi }`: zrovna se stahuje?
 * POST — spustí stažení NA POZADÍ (trvá ~10 min, dotazy s pauzami) a hned
 *        odpoví 202. Výsledek se uloží k volbě dopravy, chyby přijdou
 *        vývojáři e-mailem — stejně jako noční běh v 1:00.
 */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.json({ bezi: cenikSeStahuje() })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (cenikSeStahuje()) {
    res.status(202).json({ bezi: true, zprava: "Ceník se už stahuje." })
    return
  }
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  void obnovCenikCp(req.scope).catch((error) =>
    logger.error(`[cp-cenik] Ruční stažení selhalo: ${error instanceof Error ? error.message : error}`)
  )
  res.status(202).json({ bezi: true, zprava: "Stahuji ceník České pošty — potrvá to několik minut." })
}
