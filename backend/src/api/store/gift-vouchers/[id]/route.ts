import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { paymentStatusFromProvider } from "../../../../lib/payment-provider-status"
import { GIFT_VOUCHER_MODULE } from "../../../../modules/gift-voucher"
import type GiftVoucherModuleService from "../../../../modules/gift-voucher/service"
import { verifyGiftVoucherToken } from "../../../../lib/gift-voucher-link"
import { formatVoucherDate, serializePublicVoucher } from "../../../../lib/gift-voucher-view"

/**
 * Stránka poukazu `/poukaz/:id?token=` — kupující tu zaplatí, obdarovaný
 * vidí kód, hodnotu, zůstatek a platnost (a může si poukaz vytisknout).
 * Bez platného tokenu 404, ať se nedá zjistit, jestli id existuje.
 */
/*
 * Rychlé potvrzení platby: stránka poukazu se po návratu z brány ptá každých
 * pár vteřin. Nezaplacený poukaz s platbou se tu hned zeptá ComGate a zaplacenou
 * platbu zachytí (táž cesta jako oznámení / jobs/reconcile-gift-voucher-payments)
 * — „zaplaceno" zapíše subscriber, stránka to uvidí při dalším dotazu.
 * Nejvýš jeden dotaz na bránu za 2 s na poukaz.
 */
const CHECK_EVERY_MS = 2000
const lastCheck = new Map<string, number>()

const captureIfPaid = async (req: MedusaRequest, voucher: any) => {
  if (voucher.payment_status !== "pending" || voucher.payment_method !== "comgate" || !voucher.payment_session_id) return
  const now = Date.now()
  if (now - (lastCheck.get(voucher.id) ?? 0) < CHECK_EVERY_MS) return
  lastCheck.set(voucher.id, now)
  if (lastCheck.size > 500) lastCheck.clear()
  const paymentModule = req.scope.resolve(Modules.PAYMENT)
  const [session] = await paymentModule.listPaymentSessions({ id: voucher.payment_session_id } as never)
  if (!session) return
  const status = String((await paymentStatusFromProvider(req.scope as any, session as any))?.status ?? "").toLowerCase()
  if (status !== "captured" && status !== "authorized") return
  await processPaymentWorkflow(req.scope).run({
    input: {
      action: "captured",
      data: { session_id: voucher.payment_session_id, amount: Number(voucher.initial_value) },
    } as never,
  })
}

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
  await captureIfPaid(req, voucher).catch(() => undefined)
  res.json({
    gift_voucher: { ...serializePublicVoucher(voucher), valid_until_label: formatVoucherDate(voucher.valid_until) },
  })
}
