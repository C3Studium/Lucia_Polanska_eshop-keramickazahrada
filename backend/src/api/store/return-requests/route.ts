import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  customerName,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../../../lib/customer-email"
import { notifyMerchant } from "../../../lib/notify"
import { RETURN_REQUEST_MODULE } from "../../../modules/return-request"
import type ReturnRequestModuleService from "../../../modules/return-request/service"
import { PostStoreCreateReturnRequest } from "./validators"

/**
 * POST /store/return-requests — the returns conversation's front door.
 *
 * Today a return is agreed over e-mail; this endpoint receives the same
 * request in a structured form, confirms receipt to the customer
 * („refund-request") and rings the owner's bell. Approval/rejection happens on
 * the admin „Vrácení" page.
 *
 * ## Why every outcome answers the same way
 *
 * The route is unauthenticated (order number + e-mail is the proof of
 * ownership), so a different answer for „order not found", „e-mail does not
 * match" and „created" would be an oracle for probing which order numbers
 * exist and whose they are. Everything returns `GENERIC_RESPONSE`; the honest
 * signal for a genuine customer is the confirmation e-mail.
 */

const GENERIC_RESPONSE = { received: true }

/** The real person's name, or null — never a stored „Vážený zákazníku". */
const realCustomerName = (order: any): string | null => {
  const name = customerName(order)
  return name === "Vážený zákazníku" ? null : name
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = PostStoreCreateReturnRequest.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Vyplňte prosím číslo objednávky, e-mail a důvod vrácení."
    )
  }
  const body = parsed.data

  // „#1234" from the confirmation e-mail and a plain „1234" are the same order.
  const displayId = Number(body.order_display_id.replace(/^#/, "").trim())
  if (!Number.isInteger(displayId) || displayId <= 0) {
    return res.status(200).json(GENERIC_RESPONSE)
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "customer.first_name",
      "customer.last_name",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "billing_address.first_name",
      "billing_address.last_name",
    ],
    filters: { display_id: displayId },
  })
  const order = orders[0] as any

  if (
    !order?.email ||
    order.email.trim().toLowerCase() !== body.email.toLowerCase()
  ) {
    return res.status(200).json(GENERIC_RESPONSE)
  }

  const service = req.scope.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )

  // One open request per order. A second submit (double click, impatience)
  // must not create a second row or a second pair of e-mails.
  const pending = await service.listReturnRequests({
    order_id: order.id,
    status: "pending",
  } as never)
  if (pending.length) {
    return res.status(200).json(GENERIC_RESPONSE)
  }

  const request = await service.createReturnRequests({
    order_id: order.id,
    order_display_id: String(order.display_id),
    email: order.email,
    customer_name: realCustomerName(order) ?? undefined,
    reason: body.reason,
    // jsonb stores a bare string just fine; the generated DTO merely types the
    // json column as an object, hence the cast.
    items: (body.items?.length ? body.items : null) as unknown as Record<
      string,
      unknown
    >,
    status: "pending",
  })

  // §16 confirmation to the customer. No `refundAmount`: nothing has been
  // decided yet, and the template only renders the amount row with a real one.
  await sendCustomerEmail(req.scope, {
    template: "refund-request",
    to: order.email,
    key: `refund-request:${request.id}`,
    orderId: order.id,
    data: {
      customerName: customerName(order),
      orderNumber: orderNumber(order),
      orderLink: orderLink(order),
      refundReason: request.reason,
      estimatedProcessingTime: "3–5 pracovních dnů",
    },
  })

  // She works from her inbox (D7), and an unanswered return request is a
  // customer left waiting — so this one is bell + e-mail, not bell-only.
  await notifyMerchant(req.scope, {
    key: `mn:return-req:${request.id}`,
    title: `Žádost o vrácení k objednávce #${order.display_id}`,
    description: body.items?.length
      ? `Důvod: ${request.reason} · Objekty: ${body.items}`
      : `Důvod: ${request.reason}`,
    audience: "owner",
    urgent: false,
    email: true,
    resource: { id: order.id, type: "order" },
  })

  return res.status(200).json(GENERIC_RESPONSE)
}
