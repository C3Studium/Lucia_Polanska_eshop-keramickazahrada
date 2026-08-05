import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { notifyMerchant } from "../../../../../lib/notify"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"

/**
 * „Prosím o úpravu" — the customer's half of the approval step
 * (feature-ideas 2.3).
 *
 * When the finished piece isn't quite what they meant, the alternative to
 * this route is a worried e-mail thread. Here the request lands in the
 * zakázka's own diary — created_by "customer" — so she reads it exactly
 * where she works, and the bell rings once.
 *
 * Same access rules as the progress route: customer-authenticated, own
 * order only, 404 for anything else. Rate-limited by nature: one open
 * request per order at a time — a second one before she reacted would just
 * shout.
 */

const PostTweakSchema = z.object({
  message: z.string().trim().min(5).max(1000),
})

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const orderId = req.params.id
  const customerId = req.auth_context?.actor_id

  if (!customerId) {
    res.status(401).json({ message: "Přihlaste se prosím." })
    return
  }

  const parsed = PostTweakSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Napište prosím pár slov o tom, co upravit."
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "customer_id", "email"],
    filters: { id: orderId },
  })
  const order = orders[0] as any
  if (!order || order.customer_id !== customerId) {
    res.status(404).json({ message: "Objednávka nebyla nalezena." })
    return
  }

  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const [production] = (await madeToOrder.listProductionOrders({
    order_id: orderId,
  } as never)) as any[]
  if (!production) {
    res.status(404).json({ message: "Objednávka nebyla nalezena." })
    return
  }

  // One open request at a time: an unanswered customer entry means she has
  // not reacted yet, and piling on does not speed a kiln up.
  const existing = (await madeToOrder.listProductionNotes(
    { order_id: orderId, created_by: "customer" } as never,
    { order: { created_at: "DESC" }, take: 1 } as never
  )) as any[]
  if (existing[0] && !existing[0].deleted_at) {
    const lastAt = new Date(existing[0].created_at).getTime()
    if (Date.now() - lastAt < 1000 * 60 * 60 * 24) {
      res.status(200).json({
        received: true,
        message:
          "Vaši předchozí prosbu už máme — ozveme se, jakmile ji vyřídíme.",
      })
      return
    }
  }

  await madeToOrder.createProductionNotes({
    order_id: orderId,
    text: `Zákazník prosí o úpravu: ${parsed.data.message}`,
    image_url: null,
    visible_to_customer: false,
    created_by: "customer",
  } as never)

  await notifyMerchant(req.scope, {
    key: `tweak-request:${orderId}:${new Date().toISOString().slice(0, 10)}`,
    title: `Zákazník prosí o úpravu zakázky #${order.display_id}`,
    description: parsed.data.message.slice(0, 140),
    audience: "owner",
    urgent: false,
    email: true,
    resource: { id: orderId, type: "order" },
  }).catch(() => {
    // The diary entry is the durable record; the bell is best-effort.
  })

  res.status(201).json({
    received: true,
    message: "Děkujeme, ozveme se co nejdřív.",
  })
}
