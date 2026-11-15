import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getLegalFacts } from "../../../../lib/merchant-settings"
import { cleanEmailTexts, isEditableEmail, renderEmailPreview } from "../../../../lib/email-texts"

/**
 * Náhled e-mailu v administraci → Emaily — vzorová data šablony a právě
 * psané (neuložené) znění. Nic se neukládá ani neodesílá.
 */
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
  const legal = await getLegalFacts(req.scope).catch(() => null)
  const preview = await renderEmailPreview(
    template,
    values,
    legal && legal.source === "settings" ? legal.facts : null
  )
  res.status(200).json(preview)
}
