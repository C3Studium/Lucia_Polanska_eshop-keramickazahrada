import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"

/**
 * Send a notification again (WorkflowPlan.md §15, §22).
 *
 * A failed notification cannot simply be re-sent under its own key: the module
 * deduplicates on `idempotency_key`, and although it *does* retry a key whose
 * previous attempt failed, that would overwrite the failure record and lose the
 * evidence that it ever happened. So a retry is a new notification that points
 * back at the original through the model's own `original_notification_id`
 * column, with a suffixed key (`…:r2`, `…:r3`) that keeps each attempt
 * separately deduplicated.
 *
 * The response deliberately carries `sent: false` plus the provider's own
 * message rather than an HTTP error. When Resend rejects an e-mail, *its*
 * reason is the only useful thing on the screen — „Poslat znovu se nezdařilo"
 * tells nobody anything, and the reason is not stored anywhere on the
 * notification record.
 */

const nextAttemptKey = (key: string | null | undefined): string | undefined => {
  if (!key) {
    return undefined
  }
  const match = key.match(/^(.*):r(\d+)$/)
  if (match) {
    return `${match[1]}:r${Number(match[2]) + 1}`
  }
  return `${key}:r2`
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const notifications = req.scope.resolve(Modules.NOTIFICATION)
  const logger = req.scope.resolve("logger")

  const [original] = await notifications.listNotifications(
    { id: req.params.id } as never,
    { take: 1 }
  )

  if (!original) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Notifikace ${req.params.id} neexistuje.`
    )
  }

  const source = original as any

  try {
    const created = await notifications.createNotifications({
      to: source.to,
      channel: source.channel,
      template: source.template,
      data: source.data,
      trigger_type: source.trigger_type,
      resource_id: source.resource_id,
      resource_type: source.resource_type,
      receiver_id: source.receiver_id,
      // Chains attempts together so the list can show „opakované odeslání".
      original_notification_id: source.original_notification_id ?? source.id,
      idempotency_key: nextAttemptKey(source.idempotency_key),
    } as never)

    res.status(200).json({ sent: true, notification: created })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Neznámá chyba při odesílání."

    logger.error(
      `[notifications] Opakované odeslání ${source.id} (${source.template} → ${source.to}) selhalo: ${message}`
    )

    res.status(200).json({ sent: false, message })
  }
}
