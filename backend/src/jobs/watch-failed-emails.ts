import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { notifyMerchant } from "../lib/notify"

/**
 * Merchant notification #15 — „E-mail se nepodařilo odeslat" (§15).
 *
 * A failed e-mail is the one failure nobody finds out about on their own: the
 * customer sees nothing and assumes the shop is silent, and the shop sees
 * nothing and assumes the customer was told. The notification module already
 * records the failure — since the Resend provider throws instead of swallowing
 * errors, `status = failure` is now real — so this job only has to notice.
 *
 * It is a poller rather than a subscriber because the module records the
 * failure inside `createNotifications` and emits no event for it.
 *
 * Routed to `DEV_NOTIFICATION_EMAIL` (D7): a delivery failure is a technical
 * problem, and the person who can fix a bad API key or an unverified sending
 * domain is Matěj, not the ceramicist.
 */

/** How far back a run looks. Comfortably wider than the 15-minute schedule, so
 * a missed run or a restart cannot leave a failure permanently unreported —
 * the per-notification dedupe key makes the overlap free. */
const LOOKBACK_MINUTES = 90

export default async function watchFailedEmails(container: MedusaContainer) {
  const notifications = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve("logger")

  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000)

  const failures = await notifications.listNotifications(
    {
      channel: "email",
      status: "failure",
      created_at: { $gte: since },
    } as never,
    { take: 50, order: { created_at: "DESC" } }
  )

  if (!failures.length) {
    return
  }

  logger.warn(
    `[emails] ${failures.length} e-mail(ů) se v posledních ${LOOKBACK_MINUTES} minutách nepodařilo odeslat.`
  )

  for (const failure of failures as any[]) {
    // Keyed per failed notification, so re-running the job — or overlapping
    // lookback windows — cannot produce a second bell entry for the same one.
    await notifyMerchant(container, {
      key: `mn:emailfail:${failure.id}`,
      title: "E-mail se nepodařilo odeslat",
      description:
        `Šablona „${failure.template ?? "neznámá"}" pro ${failure.to}. ` +
        `Důvod najdete v logu serveru; odeslat znovu můžete v Přehledu → Nezdařené e-maily.`,
      audience: "dev",
      urgent: true,
      resource: { id: failure.id, type: "notification" },
    })
  }
}

export const config = {
  name: "watch-failed-emails",
  schedule: "*/15 * * * *",
}
