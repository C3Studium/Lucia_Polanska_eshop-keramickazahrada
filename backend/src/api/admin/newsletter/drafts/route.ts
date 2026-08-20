import crypto from "crypto"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { sanitizeDraftBlocks } from "../../../../lib/newsletter-blocks"
import { NEWSLETTER_MODULE } from "../../../../modules/newsletter"
import type NewsletterModuleService from "../../../../modules/newsletter/service"

/**
 * Rozepsané e-maily — the composer's server-side autosave.
 *
 * The admin saves the whole composition (subject, preheader, blocks) a couple
 * of seconds after every change, so closing the tab mid-sentence loses
 * nothing. Drafts live in `newsletter_campaign` with `status = 'draft'` and a
 * private `draft:` campaign key; sending one upgrades the same row to a sent
 * campaign (`../campaigns/route.ts#recordCampaign`), so „Rozepsané" and
 * „Historie" can never both claim the same e-mail.
 *
 * Blocks are stored through `sanitizeDraftBlocks` — the *lenient* sanitiser.
 * A draft is work in progress: a button with no URL yet must survive the
 * round trip, only dangerous content (unknown types, non-web URL schemes,
 * free-form HTML) is stripped. The strict sanitiser still guards the actual
 * send, preview and test paths.
 */

export const PostNewsletterDraftSchema = z.object({
  /** Update this draft; omit to create a new one. */
  id: z.string().min(1).optional(),
  subject: z.string().max(300).optional(),
  preheader: z.string().max(300).optional(),
  blocks: z.array(z.unknown()).max(60),
})

type PostNewsletterDraft = z.infer<typeof PostNewsletterDraftSchema>

const DRAFT_LIST_LIMIT = 20

const draftFields = [
  "id",
  "subject",
  "preheader",
  "blocks",
  "updated_at",
] as const

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const newsletter = req.scope.resolve<NewsletterModuleService>(
    NEWSLETTER_MODULE
  )

  const drafts = await newsletter.listNewsletterCampaigns(
    { status: "draft" } as never,
    {
      take: DRAFT_LIST_LIMIT,
      order: { updated_at: "DESC" },
      select: [...draftFields],
    } as never
  )

  res.json({ drafts })
}

export async function POST(
  req: AuthenticatedMedusaRequest<PostNewsletterDraft>,
  res: MedusaResponse
) {
  const payload = (req.validatedBody || req.body) as PostNewsletterDraft
  const newsletter = req.scope.resolve<NewsletterModuleService>(
    NEWSLETTER_MODULE
  )

  const subject = payload.subject?.trim() ?? ""
  const preheader = payload.preheader?.trim() || null
  const blocks = sanitizeDraftBlocks(payload.blocks)

  if (payload.id) {
    const [draft] = await newsletter.listNewsletterCampaigns(
      { id: payload.id, status: "draft" } as never
    )
    if (!draft) {
      // Sent meanwhile (possibly from another tab), or deleted. The composer
      // reacts by starting a fresh draft rather than resurrecting this one.
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Tento rozepsaný e-mail už neexistuje — mohl být mezitím odeslán nebo smazán."
      )
    }

    await newsletter.updateNewsletterCampaigns({
      id: draft.id,
      subject,
      preheader,
      blocks,
    } as never)

    const [updated] = await newsletter.listNewsletterCampaigns(
      { id: draft.id } as never,
      { select: [...draftFields] } as never
    )
    res.json({ draft: updated })
    return
  }

  const created = await newsletter.createNewsletterCampaigns({
    subject,
    preheader,
    blocks,
    // A private, collision-free key: the unique index on `campaign_key`
    // covers drafts too, and a draft must never shadow a real campaign key.
    campaign_key: `draft:${crypto.randomUUID()}`,
    status: "draft",
    recipients: null,
    sent_at: null,
  } as never)

  const row = Array.isArray(created) ? created[0] : created
  res.status(201).json({ draft: row })
}
