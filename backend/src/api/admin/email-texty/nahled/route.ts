import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getLegalFacts } from "../../../../lib/merchant-settings"
import {
  cleanEmailTexts,
  isEditableEmail,
  isPreviewableEmail,
  renderEmailPreview,
} from "../../../../lib/email-texts"

/**
 * Náhled e-mailu v administraci → Emaily — vzorová data šablony a právě
 * psané (neuložené) znění. Nic se neukládá ani neodesílá.
 */
export const POST = async (
  req: MedusaRequest<{ template?: unknown; values?: unknown }>,
  res: MedusaResponse
) => {
  const template = typeof req.body?.template === "string" ? req.body.template : ""
  if (!isPreviewableEmail(template)) {
    res.status(400).json({ message: "Takový e-mail neznáme." })
    return
  }
  /* Podoby „Nové objednávky" (šablona#podoba) nemají co přepsat — jen náhled. */
  const values = isEditableEmail(template)
    ? cleanEmailTexts(
        template,
        (req.body?.values && typeof req.body.values === "object" ? req.body.values : {}) as Record<string, unknown>
      )
    : {}
  const legal = await getLegalFacts(req.scope).catch(() => null)
  const preview = await renderEmailPreview(
    template,
    values,
    legal && legal.source === "settings" ? legal.facts : null
  )
  res.status(200).json(preview)
}
