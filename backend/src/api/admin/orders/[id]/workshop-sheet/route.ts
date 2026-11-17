import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { buildWorkshopSheet } from "../../../../../lib/workshop-sheet"

/**
 * „Stáhnout list pro dílnu (PDF)" — tentýž list, který chodí v příloze
 * e-mailu o nové objednávce, vyrobený načerstvo z dnešních dat (po potvrzení
 * zadání, doplatku nebo poznámce dílny je aktuální).
 *
 * Vrací rovnou PDF; tlačítko v administraci si ho stáhne přes přihlášenou
 * relaci (`sdk.client.fetch`) a uloží jako soubor. `/admin/*` je chráněné
 * přihlášením Medusy — kontrola `actor_id` je jen pojistka.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Přihlaste se prosím znovu." })
    return
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const orderId = req.params.id

  try {
    const built = await buildWorkshopSheet(req.scope, orderId)
    if (!built) {
      res.status(404).json({ message: "Objednávka nebyla nalezena." })
      return
    }
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${built.filename}"`)
    res.setHeader("Content-Length", String(built.bytes.length))
    res.setHeader("Cache-Control", "no-store")
    res.status(200).send(built.bytes)
  } catch (error) {
    logger.error(
      `[list pro dílnu] PDF objednávky ${orderId} se nepodařilo vytvořit: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    res.status(502).json({ message: "List pro dílnu se teď nepodařilo vytvořit. Zkuste to prosím za chvíli." })
  }
}
