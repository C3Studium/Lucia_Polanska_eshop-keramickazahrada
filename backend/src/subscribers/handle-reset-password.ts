import {
  SubscriberArgs,
  type SubscriberConfig,
} from "@medusajs/medusa"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { isPasswordResetSilent, setPasswordResetToken } from "lib/password-reset-silencer"
import { resetPasswordLink } from "lib/storefront-url"
import { BACKEND_URL } from "lib/constants"

/**
 * Mails the password-reset link — to the storefront for customers, to the
 * admin for users.
 *
 * The customer link comes from `lib/storefront-url` like every other
 * customer-facing URL. It used to fall back to `https://storefront.com` when
 * the env was missing — a live reset token, mailed to a domain nobody owns.
 * Now a missing configuration refuses to send and says so in the log, which
 * is the failure someone actually notices.
 */
export default async function resetPasswordTokenHandler({
  event: { data: {
    entity_id: email,
    token,
    actor_type,
  } },
  container,
}: SubscriberArgs<{ entity_id: string, token: string, actor_type: string }>) {
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  // Always store token so internal flows can consume it
  if (token && email) {
    setPasswordResetToken(email, token)
  }

  // If silent mode is enabled for this email, do not send email
  if (isPasswordResetSilent(email)) {
    return
  }

  let resetUrl: string

  if (actor_type === "customer") {
    resetUrl = resetPasswordLink(token, email)
    if (!resetUrl) {
      logger.error(
        "Password-reset e-mail NOT sent: STOREFRONT_PUBLIC_URL is not configured, " +
          "so there is no valid link to put in it."
      )
      return
    }
  } else {
    const config = container.resolve("configModule")
    const adminPath = config.admin?.path ?? "/app"
    resetUrl =
      `${BACKEND_URL.replace(/\/+$/, "")}${adminPath}` +
      `/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
  }

  await notificationModuleService.createNotifications({
    to: email,
    channel: "email",
    template: "password-reset",
    data: {
      reset_url: resetUrl,
      // The template shows which account the reset belongs to — useful for
      // anyone with more than one address in one inbox.
      email,
    },
  })
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
