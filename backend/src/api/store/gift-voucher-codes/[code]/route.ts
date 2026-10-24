import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GIFT_VOUCHER_MODULE } from "../../../../modules/gift-voucher"
import type GiftVoucherModuleService from "../../../../modules/gift-voucher/service"
import { looksLikeVoucherCode, normalizeVoucherCode, voucherState } from "../../../../modules/gift-voucher/code"
import { formatVoucherDate } from "../../../../lib/gift-voucher-view"

/**
 * Pole „Slevový kód nebo dárkový poukaz“ v košíku a pokladně se ptá, jestli
 * je zadaný kód poukaz — a pokud ano, v jakém tvaru ho poslat do košíku
 * (velká písmena, bez mezer) a proč případně neplatí. Poukaz se pak uplatní
 * jako běžný slevový kód (`lib/gift-voucher-promotion.ts`).
 *
 * Neprozrazuje nic citlivého: kód zná jen ten, kdo poukaz drží, a odpověď
 * obsahuje jen stav a zůstatek — totéž, co má na poukazu.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const raw = String(req.params.code ?? "")
  if (!looksLikeVoucherCode(raw)) {
    res.json({ is_voucher: false })
    return
  }
  const code = normalizeVoucherCode(raw)
  const service = req.scope.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const [voucher] = (await service.listGiftVouchers({ code } as never)) as any[]
  if (!voucher) {
    res.json({ is_voucher: false })
    return
  }
  const state = voucherState(voucher)
  res.json({
    is_voucher: true,
    code,
    state,
    balance: state === "active" ? Number(voucher.balance) : 0,
    valid_until_label: formatVoucherDate(voucher.valid_until),
  })
}
