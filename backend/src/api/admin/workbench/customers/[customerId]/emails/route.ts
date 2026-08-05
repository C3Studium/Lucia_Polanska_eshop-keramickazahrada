import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Everything the shop has sent one customer — Zákazníci+ detail drawer.
 *
 * „Psali jste mi?" is answered here by reading, not remembering. Keyed by
 * the customer's e-mail address rather than id because that is how the
 * notification module addresses people; failures are included deliberately —
 * a send that failed *is* the answer to why the customer never got it.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: { id: req.params.customerId },
  })
  const customer = customers[0] as any

  if (!customer?.email) {
    res.status(404).json({ message: "Zákazník nebyl nalezen." })
    return
  }

  const { data: notifications } = await query
    .graph({
      entity: "notification",
      fields: ["id", "channel", "template", "status", "created_at"],
      filters: { to: customer.email } as never,
      pagination: { take: 100, skip: 0, order: { created_at: "DESC" } },
    })
    .catch(() => ({ data: [] as any[] }))

  res.status(200).json({
    customer_id: customer.id,
    email: customer.email,
    emails: (notifications as any[])
      .filter((notification) => notification.channel === "email")
      .map((notification) => ({
        template: notification.template,
        status: notification.status,
        created_at: notification.created_at,
      })),
  })
}
