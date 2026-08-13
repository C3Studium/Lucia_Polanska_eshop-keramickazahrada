import {
  SubscriberArgs,
  type SubscriberConfig,
} from "@medusajs/medusa"
import { Modules } from "@medusajs/framework/utils"
import { verifyEmailLink } from "../lib/storefront-url"

/**
 * Sends the verification e-mail when a *registration* creates a customer.
 *
 * `customer.created` fires for every customer record — including the guest
 * records checkout mints for every anonymous order. Those must not get a
 * verification mail: they never asked for an account, and the link would have
 * carried `token=undefined`. The registration is recognisable by the
 * verification token the storefront signup writes into metadata at create
 * time, so the token doubles as the gate.
 *
 * The URL comes from storefront-url.ts like every other customer-facing link —
 * this used to be one of two places building it inline off
 * `configModule.admin.storefrontUrl`, a third idea of where the storefront
 * lives.
 */
export default async function emailVerificationHandler({
  event: { data: { id } },
  container,
}: SubscriberArgs<{ id: string }>) {
  const customerModuleService = container.resolve(Modules.CUSTOMER)
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)

  const customer = await customerModuleService.retrieveCustomer(id)
  const token = customer.metadata?.email_verification_token as
    | string
    | undefined

  if (!token || !customer.email) {
    return
  }

  const verificationUrl = verifyEmailLink(token, customer.email)
  if (!verificationUrl) {
    console.error(
      "[email-verification] STOREFRONT_PUBLIC_URL/MEDUSA_STOREFRONT_URL not set — cannot build the verification link."
    )
    return
  }

  await notificationModuleService.createNotifications({
    to: customer.email,
    channel: "email",
    template: "email-verification",
    data: {
      verification_url: verificationUrl,
      email: customer.email,
    },
  })
}

export const config: SubscriberConfig = {
  event: "customer.created",
}
