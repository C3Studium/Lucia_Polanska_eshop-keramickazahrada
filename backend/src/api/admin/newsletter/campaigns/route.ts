import crypto from "crypto"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { formatDate, storefrontBase } from "../../../../lib/customer-email"
import {
  campaignContentProblems,
  sanitizeBlocks,
  type NewsletterBlock,
} from "../../../../lib/newsletter-blocks"
import { sendCampaign } from "../../../../lib/newsletter-campaign"
import { newsletterUnsubscribeUrl } from "../../../../lib/newsletter-link"
import { NEWSLETTER_MODULE } from "../../../../modules/newsletter"
import type NewsletterModuleService from "../../../../modules/newsletter/service"

/**
 * Newsletter campaigns: composed in the admin, sent to every confirmed
 * subscriber, remembered in `newsletter_campaign`.
 *
 * ## Two payload shapes, one endpoint
 *
 * The new shape is the admin's block editor: `subject` + `blocks`, rendered
 * by the `promotional` template's block path. The original discount shape
 * (`code`/`benefit`/`valid_until`) stays accepted so existing callers and
 * scripts keep working — see the original rationale below. `blocks` present
 * decides which path runs.
 *
 * The discount shape's rule is unchanged: the `promotional` template's
 * legacy layout unconditionally renders the Kód / Zvýhodnění / Platí do
 * ledger rows and its prop *defaults are mock data* („KERAMIKA20"), so
 * `code`, `benefit` and `valid_until` are required — what the template will
 * print must be what she actually typed.
 *
 * ## Idempotency
 *
 * `key` is the campaign's identity: the same key never re-sends
 * (`lib/newsletter-campaign.ts`), which is what makes this endpoint safe to
 * retry. For block campaigns the default key is a hash of the content
 * scoped to the day — a double-click or a retried request re-sends nothing,
 * while deliberately sending the same text again next month is a new
 * campaign. The history row is upserted by that key, so a retry updates its
 * recipient count instead of claiming a second campaign.
 *
 * ## The unsubscribe guard is a refusal, not a warning
 *
 * Without BACKEND_PUBLIC_URL/MEDUSA_BACKEND_URL every unsubscribe link in
 * the mail would be dead — an e-mail Czech law does not allow to exist. The
 * admin disables its send button on `unsubscribe_ready: false`; this
 * endpoint refuses independently, so no caller can slip past the UI.
 */

const BlockCampaignSchema = z.object({
  key: z.string().min(1).optional(),
  subject: z.string().min(1).max(300),
  preheader: z.string().max(300).optional(),
  blocks: z.array(z.unknown()).min(1),
  /**
   * The autosaved draft this send came from (`/admin/newsletter/drafts`).
   * When given, the draft row *becomes* the sent history row instead of a
   * second row appearing next to a leftover draft.
   */
  draft_id: z.string().min(1).optional(),
})

const DiscountCampaignSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  cta_label: z.string().optional(),
  cta_url: z.string().url().optional(),
  code: z.string().min(1),
  benefit: z.string().min(1),
  valid_until: z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "valid_until must be a parseable date",
    }),
})

export const PostNewsletterCampaignSchema = z.union([
  BlockCampaignSchema,
  DiscountCampaignSchema,
])

type PostNewsletterCampaign = z.infer<typeof PostNewsletterCampaignSchema>

/** Shared with the announce-bundle route — every campaign path must refuse. */
export const requireWorkingUnsubscribe = () => {
  if (!newsletterUnsubscribeUrl("probe@example.com")) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Kampaň nelze odeslat: BACKEND_PUBLIC_URL/MEDUSA_BACKEND_URL není nastaveno, takže odhlašovací odkazy v e-mailu by nefungovaly. Nastavte adresu backendu a zkuste to znovu."
    )
  }
}

/** Content-derived default key: same text same day = the same campaign. */
const defaultBlockCampaignKey = (
  subject: string,
  blocks: NewsletterBlock[]
): string => {
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify({ subject, blocks }))
    .digest("hex")
    .slice(0, 12)
  const day = new Date().toISOString().slice(0, 10)
  return `blocks:${day}:${digest}`
}

/** The slice of the module `recordCampaign` needs — fakeable in unit tests. */
export type CampaignHistoryStore = {
  listNewsletterCampaigns(
    filter: unknown,
    config?: unknown
  ): Promise<Array<Record<string, unknown>>>
  createNewsletterCampaigns(data: unknown): Promise<unknown>
  updateNewsletterCampaigns(data: unknown): Promise<unknown>
  softDeleteNewsletterCampaigns(ids: string[]): Promise<unknown>
}

/**
 * Writes the history row for a completed fan-out.
 *
 * Three cases, in precedence order:
 *
 * 1. A row with this `campaign_key` exists (a retried request): its
 *    recipient count grows and it is marked sent. If the send also named a
 *    draft, that draft is now redundant — its content just went out under
 *    the existing row — and is removed rather than left to haunt the
 *    „Rozepsané" list.
 * 2. The send named a draft: the draft row is *upgraded* — it gets the real
 *    campaign key, the content as sent, recipients, `sent_at` and
 *    status 'sent'. One row, whole life story.
 * 3. Otherwise a fresh sent row is created.
 */
export const recordCampaign = async (
  newsletter: CampaignHistoryStore,
  input: {
    campaign_key: string
    subject: string
    preheader: string | null
    blocks: NewsletterBlock[] | null
    sent: number
    /** Sanitised delivery-report tag (`lib/newsletter-events.ts`). */
    tag: string | null
    draft_id?: string | null
  }
) => {
  const [existing] = await newsletter.listNewsletterCampaigns({
    campaign_key: input.campaign_key,
  })

  if (existing) {
    await newsletter.updateNewsletterCampaigns({
      id: existing.id,
      recipients: Number(existing.recipients ?? 0) + input.sent,
      status: "sent",
      sent_at: existing.sent_at ?? new Date(),
      ...(input.tag ? { tag: input.tag } : {}),
    })

    if (input.draft_id && input.draft_id !== existing.id) {
      const [draft] = await newsletter.listNewsletterCampaigns({
        id: input.draft_id,
        status: "draft",
      })
      if (draft) {
        await newsletter.softDeleteNewsletterCampaigns([input.draft_id])
      }
    }
    return
  }

  if (input.draft_id) {
    const [draft] = await newsletter.listNewsletterCampaigns({
      id: input.draft_id,
      status: "draft",
    })
    if (draft) {
      await newsletter.updateNewsletterCampaigns({
        id: draft.id,
        campaign_key: input.campaign_key,
        subject: input.subject,
        preheader: input.preheader,
        blocks: input.blocks,
        recipients: input.sent,
        sent_at: new Date(),
        status: "sent",
        tag: input.tag,
      })
      return
    }
  }

  await newsletter.createNewsletterCampaigns({
    subject: input.subject,
    preheader: input.preheader,
    blocks: input.blocks,
    campaign_key: input.campaign_key,
    recipients: input.sent,
    sent_at: new Date(),
    status: "sent",
    tag: input.tag,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<PostNewsletterCampaign>,
  res: MedusaResponse
) {
  const payload = (req.validatedBody || req.body) as PostNewsletterCampaign
  const newsletter = req.scope.resolve<NewsletterModuleService>(
    NEWSLETTER_MODULE
  )

  if ("blocks" in payload) {
    const blocks = sanitizeBlocks(payload.blocks)
    const problems = campaignContentProblems({
      subject: payload.subject,
      blocks,
    })

    if (problems.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Kampaň nelze odeslat: ${problems.join(" ")}`
      )
    }

    requireWorkingUnsubscribe()

    const subject = payload.subject.trim()
    const preheader = payload.preheader?.trim() || null
    const campaignKey =
      payload.key ?? defaultBlockCampaignKey(subject, blocks)

    const { sent, failed, tag } = await sendCampaign(req.scope, {
      campaignKey,
      template: "promotional",
      data: {
        subject,
        ...(preheader ? { preheader } : {}),
        blocks,
      },
    })

    await recordCampaign(newsletter as unknown as CampaignHistoryStore, {
      campaign_key: campaignKey,
      subject,
      preheader,
      blocks,
      sent,
      tag,
      draft_id: payload.draft_id ?? null,
    })

    res.json({ ok: true, sent, failed, key: campaignKey })
    return
  }

  requireWorkingUnsubscribe()

  // The template's fixed button says „Prohlédnout objekty"; without an
  // explicit target it goes where that promise leads — the shop page.
  const fallbackLink = storefrontBase() ? `${storefrontBase()}/store` : ""

  const { sent, failed, tag } = await sendCampaign(req.scope, {
    campaignKey: payload.key,
    template: "promotional",
    data: {
      subject: payload.title,
      discountCode: payload.code,
      discountPercentage: payload.benefit,
      expiryDate: formatDate(payload.valid_until),
      productLink: payload.cta_url || fallbackLink,
    },
  })

  await recordCampaign(newsletter as unknown as CampaignHistoryStore, {
    campaign_key: payload.key,
    subject: payload.title,
    preheader: null,
    blocks: null,
    sent,
    tag,
  })

  res.json({ ok: true, sent, failed, key: payload.key })
}

/** Past campaigns, newest first — the „Historie" tab. Drafts live in
 * `/admin/newsletter/drafts`; here only what actually went out. */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const newsletter = req.scope.resolve<NewsletterModuleService>(
    NEWSLETTER_MODULE
  )

  const campaigns = await newsletter.listNewsletterCampaigns(
    { status: "sent" } as never,
    {
      take: 50,
      order: { sent_at: "DESC" },
      select: [
        "id",
        "subject",
        "preheader",
        "campaign_key",
        "recipients",
        "sent_at",
      ],
    } as never
  )

  res.json({ campaigns })
}
