import { retrieveCustomer } from "@lib/data/customer"
import VerifyEmailReminderPage from "@modules/account/templates/send-email-verification-again-page"

/**
 * Same reason as the login slot's default: this slot has one page, at /account, and the layout
 * can choose it on any account URL — a signed-in customer who has not confirmed their e-mail
 * going straight to /account/orders picks this slot on a segment it has nothing for.
 *
 * Without a `default` that renders as a missing slot; with it, they get the reminder they would
 * have got at /account, which is the whole point of holding them there.
 */
export default async function VerifyEmailDefault() {
  const customer = await retrieveCustomer().catch(() => null)

  if (!customer) {
    return null
  }

  return <VerifyEmailReminderPage customer={{ email: customer.email }} />
}
