import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getMerchantSettings, setMerchantSettings } from "../../../lib/merchant-settings"
import { cleanEmailTexts, emailTextCatalog, isEditableEmail } from "../../../lib/email-texts"

/**
 * Administrace → Emaily (15. 11. 2026): seznam e-mailů s výchozím zněním
 * a s tím, co majitelka přepsala; zápis jedné šablony.
 *
 * POST { template, values } — values = celá šablona (předmět + pole);
 * prázdný objekt vrátí šablonu na výchozí znění.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const settings = await getMerchantSettings(req.scope)
  res.status(200).json({ emaily: emailTextCatalog(settings.email_texts) })
}

export const POST = async (
  req: MedusaRequest<{ template?: unknown; values?: unknown }>,
  res: MedusaResponse
) => {
  const template = typeof req.body?.template === "string" ? req.body.template : ""
  if (!isEditableEmail(template)) {
    res.status(400).json({ message: "Takový e-mail neznáme." })
    return
  }
  const values = cleanEmailTexts(
    template,
    (req.body?.values && typeof req.body.values === "object" ? req.body.values : {}) as Record<string, unknown>
  )
  const settings = await setMerchantSettings(req.scope, { email_texts: { [template]: values } })
  res.status(200).json({ emaily: emailTextCatalog(settings.email_texts) })
}
