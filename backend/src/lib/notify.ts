/**
 * Merchant notifications — one helper for every bell entry and merchant e-mail
 * (WorkflowPlan.md §15).
 *
 * ## Why this exists
 *
 * Medusa's notification module already gives us delivery, an audit trail and
 * deduplication; what it does not give us is *policy*. Three rules apply to
 * every merchant notification and are easy to get wrong one subscriber at a
 * time:
 *
 * 1. **Dedupe key discipline.** Every send carries an `idempotency_key` from the
 *    §15 table. `createNotifications` skips a key it has already sent
 *    successfully (`@medusajs/notification/dist/services/notification-module-service.js:51-55`),
 *    so at-least-once event delivery cannot produce a second bell entry — and a
 *    previously *failed* one is retried, which is what we want.
 * 2. **Recipient routing (D7).** Technical failures go to
 *    `DEV_NOTIFICATION_EMAIL`, business events to `OWNER_NOTIFICATION_EMAIL`.
 *    An empty value means the e-mail is skipped with a logged warning — never a
 *    crash, and never a silent drop.
 * 3. **The bell's actual contract.** The dashboard queries notifications with
 *    `channel: "feed"` and `to: [user.id, user.email, ""]`, and its renderer
 *    returns `null` unless `data.title` is set. So a feed notification must use
 *    `to: ""` to be visible to whoever is logged in, and must always carry a
 *    title. Both are enforced here rather than remembered in ten places.
 *
 * The env vars are read at call time instead of through `lib/constants` on
 * purpose: that module asserts `DATABASE_URL` at import, which would drag a
 * database requirement into every unit test that touches a notification.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/** D7: technical failures go to the developer, business events to the owner. */
export type MerchantNotificationAudience = "owner" | "dev"

export type MerchantNotificationInput = {
  /** Dedupe key from the §15 table, e.g. `mn:new-order:{order_id}`. */
  key: string
  /** Czech, shown as the bell entry's heading and the e-mail subject. */
  title: string
  /** Czech, one or two lines of context. */
  description?: string
  audience: MerchantNotificationAudience
  /**
   * Urgent items are both a bell entry and an immediate e-mail (§15). Info
   * items are bell-only unless `email` asks otherwise — D7 does exactly that
   * for „Nová zaplacená objednávka" and „Doplatek přijat", because she works
   * from her inbox.
   */
  urgent?: boolean
  email?: boolean
  /** Links the notification to an order/review/… in the notification table. */
  resource?: { id: string; type: string }
}

/** The generic merchant e-mail template registered with the Resend provider. */
export const MERCHANT_NOTIFICATION_TEMPLATE = "merchant-notification"

export type MerchantNotificationOutcome = {
  feed: boolean
  email: "sent" | "not-requested" | "no-recipient"
}

/**
 * The address for an audience, or `null` when it is not configured (D7).
 * Pure, so the routing table is testable without a container.
 */
export const resolveRecipient = (
  audience: MerchantNotificationAudience,
  addresses: { dev?: string | null; owner?: string | null }
): string | null => {
  const value = audience === "dev" ? addresses.dev : addresses.owner
  const trimmed = (value ?? "").trim()
  return trimmed.length ? trimmed : null
}

/** Both configured addresses, for the digest that goes to everyone (D7). */
export const resolveAllRecipients = (addresses: {
  dev?: string | null
  owner?: string | null
}): string[] =>
  Array.from(
    new Set(
      [addresses.dev, addresses.owner]
        .map((value) => (value ?? "").trim())
        .filter((value) => value.length)
    )
  )

const configuredAddresses = () => ({
  dev: process.env.DEV_NOTIFICATION_EMAIL,
  owner: process.env.OWNER_NOTIFICATION_EMAIL,
})

/**
 * Builds the feed notification exactly as the bell expects it. Exported so the
 * shape can be asserted in tests without a running notification module.
 */
export const buildFeedNotification = (input: MerchantNotificationInput) => ({
  // The bell filters on `to: [user.id, user.email, ""]` — an empty recipient is
  // how a notification addresses "whichever admin is looking".
  to: "",
  channel: "feed",
  template: "merchant-feed",
  data: {
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
  },
  trigger_type: input.key.split(":")[1] ?? input.key,
  idempotency_key: input.key,
  ...(input.resource
    ? { resource_id: input.resource.id, resource_type: input.resource.type }
    : {}),
})

export const buildEmailNotification = (
  input: MerchantNotificationInput,
  to: string
) => ({
  to,
  channel: "email",
  template: MERCHANT_NOTIFICATION_TEMPLATE,
  data: {
    subject: input.title,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    urgent: Boolean(input.urgent),
  },
  trigger_type: input.key.split(":")[1] ?? input.key,
  // A separate key from the feed entry: they are two deliveries of one event,
  // and one failing must not suppress the other's retry.
  idempotency_key: `${input.key}:email`,
  ...(input.resource
    ? { resource_id: input.resource.id, resource_type: input.resource.type }
    : {}),
})

/**
 * Sends one merchant notification: always the bell, plus e-mail when the item
 * is urgent or explicitly asks for it.
 *
 * Errors are not swallowed — event delivery is at-least-once and every send is
 * keyed, so a retry is safe and a permanently broken notification should be
 * visible rather than quietly lost.
 */
export const notifyMerchant = async (
  container: MedusaContainer,
  input: MerchantNotificationInput
): Promise<MerchantNotificationOutcome> => {
  const notificationModule = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const payloads: Record<string, unknown>[] = [buildFeedNotification(input)]
  let email: MerchantNotificationOutcome["email"] = "not-requested"

  if (input.urgent || input.email) {
    const recipient = resolveRecipient(input.audience, configuredAddresses())

    if (recipient) {
      payloads.push(buildEmailNotification(input, recipient))
      email = "sent"
    } else {
      email = "no-recipient"
      logger.warn(
        `Skipping the ${input.audience} e-mail for "${input.title}" — ` +
          `${
            input.audience === "dev"
              ? "DEV_NOTIFICATION_EMAIL"
              : "OWNER_NOTIFICATION_EMAIL"
          } is not set. The bell entry was still created.`
      )
    }
  }

  await notificationModule.createNotifications(payloads as never)

  return { feed: true, email }
}
