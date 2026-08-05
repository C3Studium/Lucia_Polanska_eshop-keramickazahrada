import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { formatDate, storefrontBase } from "../../../../lib/customer-email"
import { sendCampaign } from "../../../../lib/newsletter-campaign"

/**
 * One promotional campaign to every active subscriber.
 *
 * The `promotional` template is built entirely around a discount: it
 * unconditionally renders the Kód / Zvýhodnění / Platí do ledger rows, and —
 * crucially — its prop *defaults are mock data* („KERAMIKA20", a 2024 date).
 * A prop left unset would therefore mail an invented discount code to the
 * whole list. So `code`, `benefit` and `valid_until` are required here: what
 * the template will print must be what she actually typed.
 *
 * `title` becomes the subject (the Resend provider lets `data.subject` win
 * over the template default). `body` and `cta_label` are accepted so a future
 * UI can send them, but the template has no prop for either — its body copy
 * and button label are fixed — so they are deliberately dropped.
 *
 * `key` is the campaign's identity: the same key never re-sends (see
 * `lib/newsletter-campaign.ts`), which is what makes this endpoint safe to
 * retry.
 */
export const PostNewsletterCampaignSchema = z.object({
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

type PostNewsletterCampaign = z.infer<typeof PostNewsletterCampaignSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<PostNewsletterCampaign>,
  res: MedusaResponse
) {
  const payload = (req.validatedBody ||
    req.body) as PostNewsletterCampaign

  // The template's fixed button says „Prohlédnout objekty"; without an
  // explicit target it goes where that promise leads — the shop page.
  const fallbackLink = storefrontBase() ? `${storefrontBase()}/store` : ""

  const { sent } = await sendCampaign(req.scope, {
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

  res.json({ ok: true, sent })
}
