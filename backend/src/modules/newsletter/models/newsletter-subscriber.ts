import { model } from "@medusajs/framework/utils"

/**
 * One row per address, ever. Unsubscribing sets `unsubscribed_at` instead of
 * deleting the row: the address must stay known so a re-subscribe is an update
 * (not a fresh row that would re-trigger "new subscriber" behaviour), and so
 * "was this address ever subscribed" has an honest answer.
 */
const NewsletterSubscriber = model.define("newsletter_subscriber", {
  id: model.id().primaryKey(),
  email: model.text(),
  /** Where the address came from, e.g. "storefront". Nullable on purpose. */
  source: model.text().nullable(),
  subscribed_at: model.dateTime(),
  unsubscribed_at: model.dateTime().nullable(),
})
.indexes([
  {
    on: ["email"],
    unique: true
  }
])

export default NewsletterSubscriber
