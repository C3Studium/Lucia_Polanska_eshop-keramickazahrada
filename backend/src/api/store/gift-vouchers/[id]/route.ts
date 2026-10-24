import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GIFT_VOUCHER_MODULE } from "../../../../modules/gift-voucher"
import type GiftVoucherModuleService from "../../../../modules/gift-voucher/service"
import { verifyGiftVoucherToken } from "../../../../lib/gift-voucher-link"
import { formatVoucherDate, serializePublicVoucher } from "../../../../lib/gift-voucher-view"

/**
 * Stránka poukazu `/poukaz/:id?token=` — kupující tu zaplatí, obdarovaný
 * vidí kód, hodnotu, zůstatek a platnost (a může si poukaz vytisknout).
 * Bez platného tokenu 404, ať se nedá zjistit, jestli id existuje.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!verifyGiftVoucherToken(req.params.id, req.query.token)) {
    res.status(404).json({ message: "Poukaz nebyl nalezen." })
    return
  }
  const service = req.scope.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const [voucher] = (await service.listGiftVouchers({ id: req.params.id } as never)) as any[]
  if (!voucher) {
    res.status(404).json({ message: "Poukaz nebyl nalezen." })
    return
  }
  res.json({
    gift_voucher: { ...serializePublicVoucher(voucher), valid_until_label: formatVoucherDate(voucher.valid_until) },
  })
}
