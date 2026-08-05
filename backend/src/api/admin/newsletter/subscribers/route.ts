import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { NEWSLETTER_MODULE } from "../../../../modules/newsletter"
import type NewsletterModuleService from "../../../../modules/newsletter/service"

/**
 * The subscriber list at a glance, for a future admin UI.
 *
 * `count` is the number of *active* subscribers — the number a campaign would
 * actually reach, which is the only count that means anything to her.
 * `recent` is the last 20 sign-ups including unsubscribed ones (each row says
 * so), because "who joined lately and did they stay" is the interesting part.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const newsletter = req.scope.resolve<NewsletterModuleService>(
    NEWSLETTER_MODULE
  )

  const [, activeCount] = await newsletter.listAndCountNewsletterSubscribers(
    { unsubscribed_at: null } as never,
    { select: ["id"], take: 1 } as never
  )

  const recent = await newsletter.listNewsletterSubscribers(
    {} as never,
    {
      take: 20,
      order: { subscribed_at: "DESC" },
      select: ["id", "email", "source", "subscribed_at", "unsubscribed_at"],
    } as never
  )

  res.json({
    count: activeCount,
    recent,
  })
}
