import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * Sent e-mails, newest first, with the ones that failed (WorkflowPlan.md §22).
 *
 * Why this is not the native `GET /admin/notifications`: that route's validator
 * accepts `q`, `id`, `channel` and `to` — and nothing else. There is no way to
 * ask it for "the ones that failed", which is the only question this page
 * exists to answer. The rows themselves are the native notification records,
 * unmodified; this route only filters and flattens them.
 */

const asPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const notifications = req.scope.resolve(Modules.NOTIFICATION)

  const limit = Math.min(asPositiveInt(req.query.limit, 50), 100)
  const offset = asPositiveInt(req.query.offset, 0)
  const onlyFailures = req.query.status === "failure"

  const filters: Record<string, unknown> = { channel: "email" }
  if (onlyFailures) {
    filters.status = "failure"
  }
  // Every customer e-mail is tagged with its order, so the order page can show
  // exactly what that customer was told (§16, P5-3).
  if (typeof req.query.order_id === "string" && req.query.order_id) {
    filters.resource_id = req.query.order_id
  }

  const [rows, count] = await notifications.listAndCountNotifications(
    filters as never,
    { take: limit, skip: offset, order: { created_at: "DESC" } }
  )

  // Failures are counted separately from the current page so the header can say
  // how many there are even while the „vše" tab is open.
  const [, failureCount] = await notifications.listAndCountNotifications(
    { channel: "email", status: "failure" } as never,
    { take: 1 }
  )

  res.status(200).json({
    emails: (rows as any[]).map((row) => ({
      id: row.id,
      to: row.to,
      template: row.template,
      status: row.status,
      created_at: row.created_at,
      resource_id: row.resource_id,
      resource_type: row.resource_type,
      // Set on a retry, so the page can mark rows that are second attempts.
      original_notification_id: row.original_notification_id ?? null,
      // The subject the merchant-notification template was sent with; customer
      // templates carry their own, so this is often absent.
      subject:
        typeof row.data?.subject === "string" ? row.data.subject : null,
    })),
    count,
    failure_count: failureCount,
    limit,
    offset,
  })
}
