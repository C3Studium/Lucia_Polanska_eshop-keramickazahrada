import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { NEWSLETTER_MODULE } from "../../../../../modules/newsletter"
import type NewsletterModuleService from "../../../../../modules/newsletter/service"

/**
 * „Smazat" on a rozepsaný e-mail. Only drafts can be deleted — a sent
 * campaign is history, and history does not get erased from here. The row is
 * soft-deleted like every other row in this module, which also frees its
 * private `draft:` key under the partial unique index.
 */
export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const newsletter = req.scope.resolve<NewsletterModuleService>(
    NEWSLETTER_MODULE
  )

  const [draft] = await newsletter.listNewsletterCampaigns(
    { id: req.params.id, status: "draft" } as never
  )

  if (!draft) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Tento rozepsaný e-mail už neexistuje — mohl být mezitím odeslán nebo smazán."
    )
  }

  await newsletter.softDeleteNewsletterCampaigns([draft.id as string])

  res.json({ ok: true, id: draft.id })
}
