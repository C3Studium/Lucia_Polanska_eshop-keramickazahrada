import { model } from "@medusajs/framework/utils"

/**
 * One row per delivery report from the mail service (via
 * `POST /hooks/newsletter-events`): delivered, opened, clicked, bounced,
 * complained. The „Historie" tab's statistics are aggregations over these
 * rows — nothing is pre-computed, so a late report simply improves the
 * numbers the next time they are read.
 *
 * `dedupe_key` is `{report id}:{type}` and unique: the mail service retries
 * webhooks until acknowledged, and a retry must never count twice.
 *
 * `campaign_key` is resolved from the tag the fan-out stamped on the e-mail
 * (`newsletter_campaign.tag` → `campaign_key`). Nullable because a report
 * can arrive for a mail whose campaign row does not exist (test sends,
 * transactional mail with tags added later) — the event is still recorded,
 * it just belongs to no campaign's statistics.
 */
const NewsletterEvent = model.define("newsletter_event", {
  id: model.id().primaryKey(),
  campaign_key: model.text().nullable(),
  email: model.text(),
  /** 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'. */
  type: model.text(),
  /** The clicked link, for 'clicked' reports. */
  url: model.text().nullable(),
  dedupe_key: model.text(),
})
.indexes([
  {
    on: ["dedupe_key"],
    unique: true
  },
  {
    on: ["campaign_key"]
  }
])

export default NewsletterEvent
