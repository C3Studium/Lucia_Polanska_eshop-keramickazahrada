import { model } from "@medusajs/framework/utils"

/**
 * One row per address, ever. Unsubscribing sets `unsubscribed_at` instead of
 * deleting the row: the address must stay known so a re-subscribe is an update
 * (not a fresh row that would re-trigger "new subscriber" behaviour), and so
 * "was this address ever subscribed" has an honest answer.
 *
 * ## Double opt-in (zák. č. 480/2004 Sb.)
 *
 * The row is the consent evidence, so it keeps all three timestamps apart:
 *
 * - `subscribed_at` — when the address was typed into the form (signup).
 * - `confirmed_at`  — when the confirm link from the opt-in e-mail was
 *   clicked. `null` means "čeká na potvrzení" and campaigns must skip the
 *   row (`lib/newsletter-recipients.ts` is the one place that decides).
 * - `unsubscribed_at` — when they said "už ne".
 *
 * `source` says where the signup came from ("storefront"), completing the
 * who/when/where a GDPR request has to be answered with.
 */
const NewsletterSubscriber = model.define("newsletter_subscriber", {
  id: model.id().primaryKey(),
  email: model.text(),
  /** Where the address came from, e.g. "storefront". Nullable on purpose. */
  source: model.text().nullable(),
  subscribed_at: model.dateTime(),
  confirmed_at: model.dateTime().nullable(),
  unsubscribed_at: model.dateTime().nullable(),
  /**
   * Why the list itself said „už ne" (`lib/newsletter-events.ts`):
   * 'bounce' — the mailbox reported permanently undeliverable,
   * 'complaint' — the recipient marked the mail as spam.
   * Null for a person who unsubscribed by clicking the link. Set together
   * with `unsubscribed_at`, so the eligibility predicate needs no new rule.
   */
  suppressed_reason: model.text().nullable(),
})
.indexes([
  {
    on: ["email"],
    unique: true
  }
])

export default NewsletterSubscriber
