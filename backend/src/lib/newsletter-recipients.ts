/**
 * Who a newsletter campaign may legally reach.
 *
 * One predicate, used by every sender (`lib/newsletter-campaign.ts`) and by
 * the admin's recipient count, so the number she confirms in the prompt is
 * the number the fan-out uses. Zák. č. 480/2004 Sb. (double opt-in as
 * evidence of consent) reduces to three checks:
 *
 * - the address exists and is not blank,
 * - the subscriber confirmed the opt-in e-mail (`confirmed_at` set) —
 *   a signup alone is a *pending* subscriber, not a recipient,
 * - they have not unsubscribed since.
 *
 * Pure on purpose: no container, no framework imports, unit-tested in
 * `__tests__/newsletter-recipients.unit.spec.ts`.
 */

export type NewsletterRecipientCandidate = {
  email?: string | null
  confirmed_at?: Date | string | null
  unsubscribed_at?: Date | string | null
}

export const isEligibleRecipient = (
  candidate: NewsletterRecipientCandidate | null | undefined
): boolean =>
  Boolean(
    candidate &&
      (candidate.email ?? "").trim().length > 0 &&
      candidate.confirmed_at &&
      !candidate.unsubscribed_at
  )

/** Subscriber state as the admin shows it. */
export type SubscriberState = "confirmed" | "pending" | "unsubscribed"

export const subscriberState = (
  candidate: NewsletterRecipientCandidate
): SubscriberState => {
  if (candidate.unsubscribed_at) {
    return "unsubscribed"
  }
  return candidate.confirmed_at ? "confirmed" : "pending"
}
