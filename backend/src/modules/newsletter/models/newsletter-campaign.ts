import { model } from "@medusajs/framework/utils"

/**
 * One row per campaign — sent ones are the „Historie" tab, drafts are the
 * „Rozepsané e-maily" the composer autosaves into. A draft that gets sent
 * *becomes* its history row (status flips, recipients and sent_at arrive),
 * so the two lists can never disagree about what exists.
 *
 * `campaign_key` is the same key `lib/newsletter-campaign.ts` dedupes sends
 * with, so a retried request updates its existing row instead of writing a
 * second one that would claim a campaign ran twice. `blocks` keeps the
 * composed content as sent — the honest answer to "co přesně jsem tenkrát
 * poslala?", and the raw material for a future "poslat znovu podobné".
 * Drafts get a private `draft:` key until they are sent.
 */
const NewsletterCampaign = model.define("newsletter_campaign", {
  id: model.id().primaryKey(),
  subject: model.text(),
  preheader: model.text().nullable(),
  /** The block composition as sent (see `lib/newsletter-blocks.ts`). */
  blocks: model.json().nullable(),
  campaign_key: model.text(),
  /** 'draft' while she is writing, 'sent' once the fan-out ran. */
  status: model.text().default("sent"),
  /**
   * `campaign_key` sanitised to the mail service's tag charset
   * (`sanitizeCampaignTag` in `lib/newsletter-events.ts`) — stamped on every
   * outgoing e-mail and matched against incoming delivery reports.
   */
  tag: model.text().nullable(),
  /** How many subscribers the fan-out actually reached. Null on drafts. */
  recipients: model.number().nullable(),
  /** Null on drafts — a draft has not been sent, and must not claim a date. */
  sent_at: model.dateTime().nullable(),
})
.indexes([
  {
    on: ["campaign_key"],
    unique: true
  }
])

export default NewsletterCampaign
