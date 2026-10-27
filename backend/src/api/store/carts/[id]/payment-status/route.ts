import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { paymentStatusFromProvider } from "../../../../../lib/payment-provider-status"

/**
 * GET /store/carts/:id/payment-status — stav platby košíku, hned.
 *
 * Stránky po návratu z brány (`/cart/:id/pending|canceled`) se sem ptají
 * každých pár vteřin. Bez oznámení od ComGate se dřív košík dokončil až
 * dohledovou úlohou (10 min) a stránka se mezitím nepohnula. Teď:
 *
 * - košík už je dokončený → `{ state: "paid", order_id }`,
 * - brána hlásí zaplaceno → dokončí ho stejnou cestou jako ověřené oznámení
 *   (`processPaymentWorkflow` captured — objednávka, faktura, e-maily) a vrátí
 *   `paid` s objednávkou,
 * - brána hlásí zrušeno → `canceled` (e-mail „neprošla" řeší dohledová úloha),
 * - jinak `pending`.
 *
 * Id košíku zná jen ten, kdo ho má v cookie nebo v adrese z brány; odpověď
 * nevydá nic než stav a id objednávky. Nejvýš jeden dotaz na bránu za 2 s.
 */
const CHECK_EVERY_MS = 2000
const lastCheck = new Map<string, number>()

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "no-store")
  const cartId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const loadCart = async () => {
    const { data } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "completed_at",
        "order.id",
        "payment_collection.payment_sessions.id",
        "payment_collection.payment_sessions.status",
        "payment_collection.payment_sessions.provider_id",
        "payment_collection.payment_sessions.amount",
        "payment_collection.payment_sessions.data",
      ],
      filters: { id: cartId },
    })
    return (data as any[])[0] ?? null
  }

  let cart = await loadCart().catch(() => null)
  if (!cart) {
    res.status(404).json({ state: "unknown" })
    return
  }
  if (cart.order?.id) {
    res.json({ state: "paid", order_id: cart.order.id })
    return
  }

  const session = (cart.payment_collection?.payment_sessions ?? []).find(
    (s: any) => String(s?.provider_id ?? "").includes("comgate") && s?.status === "pending"
  )
  if (!session) {
    res.json({ state: "pending" })
    return
  }

  const now = Date.now()
  if (now - (lastCheck.get(cartId) ?? 0) < CHECK_EVERY_MS) {
    res.json({ state: "pending" })
    return
  }
  lastCheck.set(cartId, now)
  if (lastCheck.size > 500) lastCheck.clear()

  try {
    const status = String((await paymentStatusFromProvider(req.scope as any, session))?.status ?? "").toLowerCase()
    if (status === "canceled") {
      res.json({ state: "canceled" })
      return
    }
    if (status === "captured") {
      await processPaymentWorkflow(req.scope).run({
        input: { action: "captured", data: { session_id: session.id, amount: session.amount } } as never,
      })
      cart = await loadCart().catch(() => cart)
      res.json(cart?.order?.id ? { state: "paid", order_id: cart.order.id } : { state: "pending" })
      return
    }
  } catch (error) {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`[platby] Stav platby košíku ${cartId} se nepodařilo zjistit: ${error instanceof Error ? error.message : error}`)
  }
  res.json({ state: "pending" })
}
