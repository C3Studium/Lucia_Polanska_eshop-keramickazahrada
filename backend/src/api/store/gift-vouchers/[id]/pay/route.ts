import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { GIFT_VOUCHER_MODULE } from "../../../../../modules/gift-voucher"
import type GiftVoucherModuleService from "../../../../../modules/gift-voucher/service"
import { verifyGiftVoucherToken } from "../../../../../lib/gift-voucher-link"
import { ensureGiftVoucherPaymentLink } from "../../../../../lib/gift-voucher-payment"

/**
 * „Zaplatit poukaz" / „Zkusit zaplatit znovu" na stránce poukazu — vzor
 * `/store/courses/reservations/:id/pay`. Idempotentní: platný odkaz se vrátí
 * beze změny, zrušená platba dostane nový.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const id = req.params.id
  if (!verifyGiftVoucherToken(id, req.query.token)) {
    res.status(404).json({ message: "Poukaz nebyl nalezen." })
    return
  }
  const service = req.scope.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const [voucher] = (await service.listGiftVouchers({ id } as never)) as any[]
  if (!voucher) {
    res.status(404).json({ message: "Poukaz nebyl nalezen." })
    return
  }
  if (voucher.payment_method !== "comgate") {
    res.status(400).json({ message: "Tento poukaz se platí hotově nebo převodem — online platba k němu není." })
    return
  }
  try {
    const link = await ensureGiftVoucherPaymentLink(req.scope, voucher)
    res.json({ payment_url: link.payment_url })
  } catch (error) {
    if (error instanceof MedusaError && error.type === MedusaError.Types.INVALID_DATA) {
      res.status(400).json({ message: error.message })
      return
    }
    req.scope
      .resolve("logger")
      .error(`[poukazy] Platbu poukazu ${id} se nepodařilo založit: ${error instanceof Error ? error.message : "neznámá chyba"}`)
    res.status(502).json({ message: "Platbu se teď nepodařilo založit. Zkuste to prosím za chvíli." })
  }
}
