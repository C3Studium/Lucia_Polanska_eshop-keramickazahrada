import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"

/**
 * sessionId → order_id.
 *
 * Po doplatku ComGate vrací zákazníka na fallback adresu
 * `/{country}/payment/{session}/confirmed` (když session neměla nastavené
 * `url_paid` — typicky starší odkazy). Storefront z toho má jen id platební
 * relace a potřebuje vědět, ke které objednávce patří, aby ho poslal na její
 * přehled. Vrací jen mapování (žádná citlivá data); `null`, když se nenajde.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const [request] = (await service.listProductionPaymentRequests(
    { payment_session_id: req.params.sessionId } as never,
    { relations: ["production_order"] } as never
  )) as any[]

  res.json({
    order_id: request?.production_order?.order_id ?? null,
    type: request?.type ?? null,
  })
}
