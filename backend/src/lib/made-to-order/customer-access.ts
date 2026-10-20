import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { verifyOrderAccessToken } from "../order-access-link"

/**
 * Kdo smí sahat na zakázku zákazníka (`/store/made-to-order/:orderId/cancellation`,
 * `/cancel`): PŘIHLÁŠENÝ zákazník, kterému objednávka patří, NEBO host s
 * PODEPSANÝM tokenem objednávky (`?token=` / `body.token`,
 * `lib/order-access-link` — stejný jako u úpravy, reklamací a stavu objednávky).
 *
 * Routy `balance` / `pay-balance` tohle dřív neměly (stav doplatku není
 * tajemství a odkaz na platbu má vlastní podpis); zrušení zakázky s refundem
 * ale je úkon, který smí udělat jen zákazník té objednávky. Cizí / neexistující
 * objednávka = 404, ne 403 — potvrzení, že id existuje, je samo únik
 * (stejně jako `/store/orders/:id/progress`).
 *
 * `req.auth_context` plní `authenticate("customer", …, { allowUnauthenticated: true })`
 * v `api/middlewares.ts` — bez něj by host s tokenem nedošel k handleru.
 */
export const CUSTOMER_ACCESS_ORDER_FIELDS = [
  "id",
  "display_id",
  "customer_id",
  "email",
  "currency_code",
  "status",
  "canceled_at",
  "fulfillments.shipped_at",
  "fulfillments.canceled_at",
]

export type CustomerAccessOrder = {
  id: string
  display_id?: number | string | null
  customer_id?: string | null
  email?: string | null
  currency_code?: string | null
  status?: string | null
  canceled_at?: unknown
  fulfillments?: Array<{ shipped_at?: unknown; canceled_at?: unknown }> | null
}

const tokenOf = (req: MedusaRequest): string => {
  const fromQuery = req.query?.token
  if (typeof fromQuery === "string" && fromQuery) return fromQuery
  const fromBody = (req.body as any)?.token
  return typeof fromBody === "string" ? fromBody : ""
}

export const loadCustomerOrder = async (
  req: MedusaRequest,
  orderId: string
): Promise<CustomerAccessOrder> => {
  const customerId = (req as any).auth_context?.actor_id as string | undefined
  const token = tokenOf(req)
  const tokenOk = Boolean(token) && verifyOrderAccessToken(orderId, token)

  if (!customerId && !tokenOk) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Přihlaste se prosím, nebo otevřete odkaz z e-mailu k objednávce."
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: CUSTOMER_ACCESS_ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = orders[0] as CustomerAccessOrder | undefined

  if (!order || (!tokenOk && order.customer_id !== customerId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }
  return order
}
