import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * Systémová platba (`pp_system_default`) jen pro objednávku za 0 Kč.
 *
 * Objednávka výrobku s cenou po domluvě (lib/price-on-request.ts) může mít
 * k úhradě 0 Kč a ComGate nulovou platbu neumí — storefront pak založí relaci
 * systémového poskytovatele Medusy, který „autorizuje" bez peněz. Kdyby ji
 * šlo založit i na kolekci s částkou, dal by se přes Store API dokončit
 * jakýkoli košík bez zaplacení. Proto: systémová relace projde jen na
 * kolekci s nulovou částkou (srovnanou na košík — tenhle strážce běží jako
 * poslední, po balném a doběrečném, které částku mění).
 */
export const SYSTEM_PROVIDER_PREFIX = "pp_system_default"

export const requireZeroAmountForSystemProvider = () => {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      const providerId = String((req.body as { provider_id?: unknown } | undefined)?.provider_id ?? "")
      if (!providerId.startsWith(SYSTEM_PROVIDER_PREFIX)) return next()
      const paymentModule = req.scope.resolve(Modules.PAYMENT)
      const collection = await paymentModule.retrievePaymentCollection(req.params.id).catch(() => null)
      const amount = Number((collection as any)?.amount ?? NaN)
      if (!collection || !(Math.abs(amount) < 0.005)) {
        res.status(400).json({
          type: "not_allowed",
          message: "Bez platby lze odeslat jen objednávku za 0 Kč. Zvolte prosím platbu kartou.",
        })
        return
      }
      return next()
    } catch (error) {
      return next(error)
    }
  }
}
