import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { render } from "@react-email/components"
import type { ReactElement } from "react"
import {
  campaignContentProblems,
  sanitizeBlocks,
} from "../../../../lib/newsletter-blocks"
import { newsletterUnsubscribeUrl } from "../../../../lib/newsletter-link"
import { PromotionalEmail } from "../../../../modules/resend/emails/promotional"

/**
 * Live preview for the „Napsat" tab.
 *
 * Renders the *actual* e-mail HTML server-side — same component
 * (`PromotionalEmail` with `blocks`), same `@react-email` renderer the
 * Resend provider uses — so what the admin sees in the iframe is what the
 * subscriber gets, legal footer included. A client-side approximation would
 * drift the first time either side changed.
 *
 * The unsubscribe link uses a sample address: the real one is per-recipient
 * and signed at send time. When the backend URL is unconfigured a visibly
 * fake placeholder renders instead — and `problems` plus the subscribers
 * endpoint's `unsubscribe_ready` keep the send button disabled anyway.
 */
export const PostNewsletterPreviewSchema = z.object({
  subject: z.string().max(300).optional(),
  preheader: z.string().max(300).optional(),
  blocks: z.array(z.unknown()),
})

type PostNewsletterPreview = z.infer<typeof PostNewsletterPreviewSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<PostNewsletterPreview>,
  res: MedusaResponse
) {
  const payload = (req.validatedBody || req.body) as PostNewsletterPreview

  const blocks = sanitizeBlocks(payload.blocks)

  const html = await render(
    PromotionalEmail({
      subject: payload.subject?.trim() || "Zpráva z ateliéru",
      preheader: payload.preheader?.trim() || undefined,
      // Preview an empty composition as an empty e-mail rather than the
      // legacy discount mock the template would otherwise fall back to.
      blocks: blocks.length ? blocks : [{ type: "paragraph", text: " " }],
      unsubscribeLink:
        newsletterUnsubscribeUrl("nahled@example.com") ??
        "https://example.com/odhlaseni-jen-v-nahledu",
    }) as ReactElement
  )

  res.json({
    html,
    problems: campaignContentProblems({
      subject: payload.subject,
      preheader: payload.preheader,
      blocks,
    }),
  })
}
