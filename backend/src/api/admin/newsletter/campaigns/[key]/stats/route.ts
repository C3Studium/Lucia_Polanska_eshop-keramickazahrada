import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  aggregateNewsletterEvents,
  type NewsletterEventRow,
} from "../../../../../../lib/newsletter-events"
import { NEWSLETTER_MODULE } from "../../../../../../modules/newsletter"
import type NewsletterModuleService from "../../../../../../modules/newsletter/service"

/**
 * One campaign's delivery numbers for the „Historie" tab: odesláno,
 * doručeno, otevřeno, kliknuto, nedoručitelné, stížnosti — plus per-link
 * clicks. Aggregated live from `newsletter_event` (the rows the mail
 * service's reports create via `POST /hooks/newsletter-events`), so a
 * report that arrives tomorrow simply improves tomorrow's numbers.
 *
 * `measurement_ready: false` means the delivery-report connection is not
 * configured on this server — the admin shows a calm Czech note instead of
 * eternal zeros that would read as „nobody opened it".
 */

const PAGE_SIZE = 500
const HARD_CAP = 20000

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const newsletter = req.scope.resolve<NewsletterModuleService>(
    NEWSLETTER_MODULE
  )

  const campaignKey = req.params.key
  const [campaign] = await newsletter.listNewsletterCampaigns(
    { campaign_key: campaignKey } as never,
    {
      select: ["id", "subject", "campaign_key", "recipients", "sent_at"],
    } as never
  )

  if (!campaign) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Tahle kampaň v historii není."
    )
  }

  const events: NewsletterEventRow[] = []
  let skip = 0
  for (;;) {
    const page = (await newsletter.listNewsletterEvents(
      { campaign_key: campaignKey } as never,
      {
        take: PAGE_SIZE,
        skip,
        select: ["email", "type", "url"],
      } as never
    )) as NewsletterEventRow[]

    events.push(...page)
    if (page.length < PAGE_SIZE || events.length >= HARD_CAP) {
      break
    }
    skip += PAGE_SIZE
  }

  res.json({
    campaign,
    measurement_ready: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    stats: {
      sent: Number(campaign.recipients ?? 0),
      ...aggregateNewsletterEvents(events),
    },
  })
}
