import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { MAX_ATTEMPTS, nextAttemptKey, planEmailRetries, RETRY_DELAYS_MIN } from "../lib/email-retry"
import { notifyMerchant } from "../lib/notify"
import { sUlohou } from "../lib/provozni-hlidka/uloha"

/**
 * Merchant notification #15 — „E-mail se nepodařilo odeslat" (§15) +
 * automatické opakování (22. 11. 2026).
 *
 * A failed e-mail is the one failure nobody finds out about on their own: the
 * customer sees nothing and assumes the shop is silent, and the shop sees
 * nothing and assumes the customer was told. The notification module already
 * records the failure — since the Resend provider throws instead of swallowing
 * errors, `status = failure` is now real — so this job only has to notice.
 *
 * Od 22. 11. ho i POŠLE ZNOVU (lib/email-retry): po 10 min, 1 h a 6 h od
 * posledního pokusu, nejvýš 3×, a jen dokud žádný pokus v řetězu neprošel
 * (ani ruční „Poslat znovu"). 21. 11. při přepnutí účtu Resend ležel e-mail
 * „Odesláno" zákaznici 15 hodin, než ho někdo poslal ručně.
 *
 * It is a poller rather than a subscriber because the module records the
 * failure inside `createNotifications` and emits no event for it.
 *
 * Routed to `DEV_NOTIFICATION_EMAIL` (D7): a delivery failure is a technical
 * problem, and the person who can fix a bad API key or an unverified sending
 * domain is Matěj, not the ceramicist.
 */

/** Hlášení: jak daleko zpět se hledají nové pády (širší než 15min rozvrh). */
const LOOKBACK_MINUTES = 90

/** Opakování: řetěz se sleduje den — pokrývá všechny odstupy (10 + 60 + 360 min). */
const RETRY_LOOKBACK_MINUTES = 24 * 60

/** Nejvýš tolik opakování za běh, s mezerou — Resend dovolí 10 požadavků/s. */
const MAX_RETRIES_PER_RUN = 10
const RETRY_GAP_MS = 250

const FAILURE_ALERT_TITLE = "E-mail se nepodařilo odeslat"

/** Je to samo hlášení o nezdařeném e-mailu? O něm se další hlášení neposílá
 *  (jinak by výpadek Resendu plodil hlášení o hlášení). */
const isFailureAlert = (notification: any) =>
  notification?.template === "merchant-notification" &&
  String(notification?.data?.title ?? "").startsWith(FAILURE_ALERT_TITLE)

async function watchFailedEmails(container: MedusaContainer) {
  const notifications = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve("logger")

  /* ————— 1. opakování ————— */
  const retrySince = new Date(Date.now() - RETRY_LOOKBACK_MINUTES * 60 * 1000)
  const recent = (await notifications.listNotifications(
    { channel: "email", created_at: { $gte: retrySince } } as never,
    { take: 1000, order: { created_at: "ASC" } }
  )) as any[]

  const plan = planEmailRetries(recent, new Date())
  for (const failure of plan.retry.slice(0, MAX_RETRIES_PER_RUN)) {
    const root = failure.original_notification_id ?? failure.id
    try {
      await notifications.createNotifications({
        to: failure.to,
        channel: failure.channel,
        template: failure.template,
        data: failure.data,
        trigger_type: failure.trigger_type,
        resource_id: failure.resource_id,
        resource_type: failure.resource_type,
        receiver_id: failure.receiver_id,
        original_notification_id: root,
        idempotency_key: nextAttemptKey(failure.idempotency_key),
      } as never)
      logger.info(
        `[emails] Automaticky posláno znovu: ${failure.template} → ${failure.to} (pokus ${nextAttemptKey(failure.idempotency_key) ?? "2"}).`
      )
    } catch (error) {
      logger.warn(
        `[emails] Opakované odeslání ${failure.template} → ${failure.to} zase selhalo: ${
          (error as Error)?.message ?? error
        }`
      )
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_GAP_MS))
  }

  /* Vyčerpané řetězy: jedno závěrečné hlášení na řetěz. */
  for (const last of plan.exhausted) {
    if (isFailureAlert(last)) continue
    const root = last.original_notification_id ?? last.id
    await notifyMerchant(container, {
      key: `mn:emailfail-final:${root}`,
      title: `${FAILURE_ALERT_TITLE} ani po ${MAX_ATTEMPTS} pokusech`,
      description:
        `Šablona „${last.template ?? "neznámá"}" pro ${last.to}. Obchod to zkusil ${MAX_ATTEMPTS}× ` +
        `a dál už sám nezkouší. Důvod je v logu serveru; poslat znovu můžete v Přehledu → Nezdařené e-maily.`,
      audience: "dev",
      urgent: true,
      resource: { id: last.id, type: "notification" },
    })
  }

  /* ————— 2. hlášení nových pádů ————— */
  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000)
  const failures = recent.filter(
    (n) => n.status === "failure" && new Date(n.created_at).getTime() >= since.getTime()
  )

  if (!failures.length) {
    return
  }

  logger.warn(
    `[emails] ${failures.length} e-mail(ů) se v posledních ${LOOKBACK_MINUTES} minutách nepodařilo odeslat.`
  )

  for (const failure of failures) {
    if (isFailureAlert(failure)) continue
    // Jedno hlášení na ŘETĚZ (původní e-mail + jeho opakování), ne na každý
    // pokus — opakování by jinak každých 15 min přidalo další urgentní zvonek.
    const root = failure.original_notification_id ?? failure.id
    await notifyMerchant(container, {
      key: `mn:emailfail:${root}`,
      title: FAILURE_ALERT_TITLE,
      description:
        `Šablona „${failure.template ?? "neznámá"}" pro ${failure.to}. ` +
        `Obchod ho sám pošle znovu po ${RETRY_DELAYS_MIN.join(", ")} minutách (nejvýš ${MAX_ATTEMPTS - 1}×). ` +
        `Důvod najdete v logu serveru; hned ho poslat můžete v Přehledu → Nezdařené e-maily.`,
      audience: "dev",
      urgent: true,
      resource: { id: failure.id, type: "notification" },
    })
  }
}

/* Běh i pád úlohy jde do provozního deníku; pád navíc do souhrnu chyb (e-mail nejvýš po 4 h). */
export default sUlohou("watch-failed-emails", watchFailedEmails)

export const config = {
  name: "watch-failed-emails",
  schedule: "*/15 * * * *",
}
