import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { newsletterUnsubscribeUrl } from "./newsletter-link"
import { notifyMerchant } from "./notify"
import { NEWSLETTER_MODULE } from "../modules/newsletter"
import type NewsletterModuleService from "../modules/newsletter/service"

/**
 * One campaign, fanned out to every active subscriber.
 *
 * ## Why the idempotency key is the whole design
 *
 * A campaign is the one e-mail where a duplicate is not a small bug but a
 * broken promise — the shop's own line is „bez zbytečného hluku". Every send
 * is keyed `campaign:{campaignKey}:{email}`, and `createNotifications` skips a
 * key it has already sent successfully. So running the same campaign twice —
 * a retried request, a double-click in a future admin UI — sends nothing new,
 * while a subscriber who joined *between* the two runs is still reached.
 * The caller controls `campaignKey`; a new key is what makes a new campaign.
 *
 * Subscribers are read page by page rather than all at once, so the list can
 * grow past what one query comfortably returns.
 */

export type NewsletterSubscriberRow = {
  id: string
  email: string
  source: string | null
  subscribed_at: Date
  unsubscribed_at: Date | null
}

export type SendCampaignInput = {
  /** Caller-controlled dedupe scope; the same key never re-sends. */
  campaignKey: string
  /** Template name, as registered in the Resend provider. */
  template: string
  /** One payload for everybody… */
  data?: Record<string, unknown>
  /** …or a payload built per subscriber. Merged over `data` when both given. */
  buildData?: (subscriber: NewsletterSubscriberRow) => Record<string, unknown>
}

/**
 * Which templates accept an `unsubscribeLink` prop. `bundle-published` takes
 * strictly `{ bundle, customer }`, so handing it a link would be noise the
 * template never renders.
 */
const TEMPLATES_WITH_UNSUBSCRIBE_LINK = new Set([
  "promotional",
  "newsletter-signup",
])

const PAGE_SIZE = 100

export const sendCampaign = async (
  container: MedusaContainer,
  input: SendCampaignInput
): Promise<{ sent: number }> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notifications = container.resolve(Modules.NOTIFICATION)
  const newsletter = container.resolve<NewsletterModuleService>(
    NEWSLETTER_MODULE
  )

  const wantsUnsubscribeLink = TEMPLATES_WITH_UNSUBSCRIBE_LINK.has(
    input.template
  )

  if (wantsUnsubscribeLink && !newsletterUnsubscribeUrl("probe@example.com")) {
    // Without BACKEND_PUBLIC_URL/MEDUSA_BACKEND_URL the template falls back
    // to its own placeholder link — say so where somebody will read it.
    logger.warn(
      "[newsletter] BACKEND_PUBLIC_URL/MEDUSA_BACKEND_URL není nastaveno — kampaň odejde bez funkčních odhlašovacích odkazů."
    )
  }

  let sent = 0
  let skip = 0

  for (;;) {
    const subscribers = (await newsletter.listNewsletterSubscribers(
      { unsubscribed_at: null } as never,
      { take: PAGE_SIZE, skip, order: { subscribed_at: "ASC" } } as never
    )) as NewsletterSubscriberRow[]

    if (!subscribers.length) {
      break
    }

    const payloads = subscribers
      .filter((subscriber) => (subscriber.email ?? "").trim().length > 0)
      .map((subscriber) => {
        const unsubscribeLink = wantsUnsubscribeLink
          ? newsletterUnsubscribeUrl(subscriber.email)
          : null

        return {
          to: subscriber.email,
          channel: "email",
          template: input.template,
          trigger_type: input.template,
          idempotency_key: `campaign:${input.campaignKey}:${subscriber.email}`,
          data: {
            ...(input.data ?? {}),
            ...(input.buildData ? input.buildData(subscriber) : {}),
            ...(unsubscribeLink ? { unsubscribeLink } : {}),
          },
        }
      })

    if (payloads.length) {
      // `createNotifications` returns only the rows it actually created —
      // already-sent keys are skipped — so this count stays honest on re-runs.
      const created = await notifications.createNotifications(
        payloads as never
      )
      sent += Array.isArray(created) ? created.length : payloads.length
    }

    if (subscribers.length < PAGE_SIZE) {
      break
    }
    skip += PAGE_SIZE
  }

  logger.info(
    `[newsletter] Kampaň „${input.campaignKey}" (šablona ${input.template}): odesláno ${sent} odběratelům.`
  )

  // Bell only — a campaign she just triggered is confirmation, not an alarm.
  await notifyMerchant(container, {
    key: `mn:newsletter-campaign:${input.campaignKey}`,
    title: `Newsletter odeslán ${sent} odběratelům`,
    description: `Kampaň „${input.campaignKey}" (šablona ${input.template}).`,
    audience: "owner",
  })

  return { sent }
}
