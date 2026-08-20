import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { sanitizeCampaignTag } from "./newsletter-events"
import { newsletterUnsubscribeUrl } from "./newsletter-link"
import { isEligibleRecipient } from "./newsletter-recipients"
import { notifyMerchant } from "./notify"
import { NEWSLETTER_MODULE } from "../modules/newsletter"
import type NewsletterModuleService from "../modules/newsletter/service"

/**
 * One campaign, fanned out to every *confirmed* subscriber.
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
 * ## Who gets it
 *
 * Only subscribers `isEligibleRecipient` approves: confirmed via the double
 * opt-in link and not unsubscribed (zák. č. 480/2004 Sb.). The database
 * filter narrows to active rows; the consent check runs in code so exactly
 * one module — `lib/newsletter-recipients.ts` — owns the definition, for
 * every caller of this function (block campaigns, discount campaigns,
 * bundle announcements alike).
 *
 * Subscribers are read page by page rather than all at once, so the list can
 * grow past what one query comfortably returns.
 */

export type NewsletterSubscriberRow = {
  id: string
  email: string
  source: string | null
  subscribed_at: Date
  confirmed_at: Date | null
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
 * Which templates accept an `unsubscribeLink` prop. Every template a campaign
 * fans out with must be here: a mail to the subscriber list is obchodní
 * sdělení (zák. č. 480/2004 Sb.) and needs its per-recipient unsubscribe
 * link. `bundle-published` renders the same legal footer as the block
 * newsletter when the link is present.
 */
const TEMPLATES_WITH_UNSUBSCRIBE_LINK = new Set([
  "promotional",
  "newsletter-signup",
  "bundle-published",
])

const PAGE_SIZE = 100

export const sendCampaign = async (
  container: MedusaContainer,
  input: SendCampaignInput
): Promise<{ sent: number; failed: number; tag: string }> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notifications = container.resolve(Modules.NOTIFICATION)
  const newsletter = container.resolve<NewsletterModuleService>(
    NEWSLETTER_MODULE
  )

  /* Every send is stamped with the campaign's tag so the mail service's
     delivery reports (`POST /hooks/newsletter-events`) can be matched back
     to this campaign. The Resend provider lifts `__resendTags` out of the
     payload before the template sees it. The same sanitised value is what
     the campaigns route stores on the history row. */
  const campaignTag = sanitizeCampaignTag(input.campaignKey)

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
  let failed = 0
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
      .filter(isEligibleRecipient)
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
            __resendTags: [{ name: "campaign", value: campaignTag }],
          },
        }
      })

    /* One at a time, each behind its own try — a single refused address must
       not abort the campaign for everyone after it. `createNotifications`
       still skips existing idempotency keys, so a re-run never double-sends. */
    for (const payload of payloads) {
      try {
        const created = await notifications.createNotifications(
          [payload] as never
        )
        sent += Array.isArray(created) ? created.length : 1
      } catch (error) {
        failed += 1
        logger.error(
          `[newsletter] Kampaň „${input.campaignKey}": e-mail pro ${
            (payload as { to?: string }).to ?? "?"
          } se nepodařilo odeslat: ${
            error instanceof Error ? error.message : "neznámá chyba"
          }`
        )
      }
    }

    if (subscribers.length < PAGE_SIZE) {
      break
    }
    skip += PAGE_SIZE
  }

  logger.info(
    `[newsletter] Kampaň „${input.campaignKey}" (šablona ${input.template}): odesláno ${sent} odběratelům${
      failed ? `, ${failed} se nepodařilo` : ""
    }.`
  )

  // Bell only — a campaign she just triggered is confirmation, not an alarm.
  await notifyMerchant(container, {
    key: `mn:newsletter-campaign:${input.campaignKey}`,
    title: failed
      ? `Newsletter odeslán ${sent} odběratelům, ${failed} nedoručeno`
      : `Newsletter odeslán ${sent} odběratelům`,
    description: `Kampaň „${input.campaignKey}" (šablona ${input.template}).${
      failed
        ? ` U ${failed} ${failed === 1 ? "adresy" : "adres"} se odeslání nepodařilo.`
        : ""
    }`,
    audience: "owner",
  }).catch(() => undefined)

  return { sent, failed, tag: campaignTag }
}
