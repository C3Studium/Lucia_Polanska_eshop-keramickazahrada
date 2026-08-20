import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { sendCustomerEmail } from "../../../../lib/customer-email"
import {
  campaignContentProblems,
  sanitizeBlocks,
} from "../../../../lib/newsletter-blocks"
import {
  newsletterUnsubscribeUrl,
  normalizeEmail,
} from "../../../../lib/newsletter-link"

/**
 * „Poslat test na můj e-mail" — one real send, to one address she typed.
 *
 * Goes through the notification module with the registered `promotional`
 * template exactly like the campaign will, so the test proves the whole
 * pipeline: template registration, block rendering, subject, unsubscribe
 * link. The idempotency key carries a timestamp on purpose — every test
 * click must send, because "changed a word, tested again" is the workflow.
 *
 * The unsubscribe link is signed for the *test recipient*. If she clicks it
 * and her address is not on the subscriber list, the unsubscribe handler
 * shrugs politely; if it is, she has unsubscribed herself — which is the
 * link working as promised.
 */
export const PostNewsletterTestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(300),
  preheader: z.string().max(300).optional(),
  blocks: z.array(z.unknown()).min(1),
})

type PostNewsletterTest = z.infer<typeof PostNewsletterTestSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<PostNewsletterTest>,
  res: MedusaResponse
) {
  const payload = (req.validatedBody || req.body) as PostNewsletterTest
  const to = normalizeEmail(payload.to)

  const blocks = sanitizeBlocks(payload.blocks)
  const problems = campaignContentProblems({
    subject: payload.subject,
    blocks,
  })

  if (problems.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Zkušební e-mail nelze poslat: ${problems.join(" ")}`
    )
  }

  const unsubscribeLink = newsletterUnsubscribeUrl(to)

  await sendCustomerEmail(req.scope, {
    template: "promotional",
    to,
    key: `nl-test:${to}:${Date.now()}`,
    data: {
      subject: payload.subject.trim(),
      preheader: payload.preheader?.trim() || undefined,
      blocks,
      ...(unsubscribeLink ? { unsubscribeLink } : {}),
    },
  })

  res.json({ ok: true })
}
