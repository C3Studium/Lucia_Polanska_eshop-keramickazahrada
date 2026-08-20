import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { newsletterUnsubscribeUrl } from "../../../../lib/newsletter-link"
import {
  isEligibleRecipient,
  subscriberState,
} from "../../../../lib/newsletter-recipients"
import { NEWSLETTER_MODULE } from "../../../../modules/newsletter"
import type NewsletterModuleService from "../../../../modules/newsletter/service"

/**
 * The whole subscriber list for the admin's „Odběratelé" tab.
 *
 * Read page by page and returned complete (capped at 5 000 rows — a ceramics
 * atelier's list, not a platform's), because the tab needs client-side
 * search and CSV export over everything, and the counts must be computed
 * over the same rows the table shows.
 *
 * `counts.confirmed` is the number a campaign would actually reach —
 * computed with the very predicate the fan-out uses
 * (`lib/newsletter-recipients.ts`), so the number in the send prompt is
 * never a different truth than the send itself.
 *
 * `unsubscribe_ready` says whether BACKEND_PUBLIC_URL/MEDUSA_BACKEND_URL is
 * set — without it unsubscribe links in campaign e-mails would be dead, and
 * the admin disables sending entirely.
 */

const PAGE_SIZE = 200
const HARD_CAP = 5000

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const newsletter = req.scope.resolve<NewsletterModuleService>(
    NEWSLETTER_MODULE
  )

  const subscribers: Array<{
    id: string
    email: string
    source: string | null
    subscribed_at: Date
    confirmed_at: Date | null
    unsubscribed_at: Date | null
    /** 'bounce' | 'complaint' when the list hygiene unsubscribed the row. */
    suppressed_reason: string | null
  }> = []

  let skip = 0
  for (;;) {
    const page = (await newsletter.listNewsletterSubscribers(
      {} as never,
      {
        take: PAGE_SIZE,
        skip,
        order: { subscribed_at: "DESC" },
        select: [
          "id",
          "email",
          "source",
          "subscribed_at",
          "confirmed_at",
          "unsubscribed_at",
          "suppressed_reason",
        ],
      } as never
    )) as typeof subscribers

    subscribers.push(...page)

    if (page.length < PAGE_SIZE || subscribers.length >= HARD_CAP) {
      break
    }
    skip += PAGE_SIZE
  }

  const counts = { confirmed: 0, pending: 0, unsubscribed: 0 }
  for (const subscriber of subscribers) {
    counts[subscriberState(subscriber)] += 1
  }

  res.json({
    // Kept for any caller of the old shape: the number a campaign reaches.
    count: subscribers.filter(isEligibleRecipient).length,
    counts,
    total: subscribers.length,
    subscribers: subscribers.map((subscriber) => ({
      ...subscriber,
      state: subscriberState(subscriber),
    })),
    unsubscribe_ready: Boolean(newsletterUnsubscribeUrl("probe@example.com")),
  })
}
