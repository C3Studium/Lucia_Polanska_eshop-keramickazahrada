import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GIFT_VOUCHER_MODULE } from "../../../../../modules/gift-voucher"
import type GiftVoucherModuleService from "../../../../../modules/gift-voucher/service"
import { verifyGiftVoucherToken } from "../../../../../lib/gift-voucher-link"
import { giftVoucherPdfInputFor, storeGiftVoucherPdf } from "../../../../../lib/gift-voucher-pdf"

/**
 * Poukaz jako PDF pro zákazníka — stránka `/poukaz/:id` si odtud bere odkaz
 * na stažení. Vrací adresu v úložišti, ne samotný soubor: stahuje se pak
 * přímo z úložiště (bez přihlašovací hlavičky, takže odkaz jde i přeposlat
 * obdarovanému).
 *
 * Bez platného tokenu 404 — stejně jako samotný detail poukazu, ať se nedá
 * zkoušet, jestli id existuje. Nezaplacený poukaz se nevystavuje vůbec:
 * uplatnit ho nejde a kód z něj se dá opsat.
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
  if (voucher.payment_status !== "paid" || voucher.status === "cancelled") {
    res.status(409).json({ message: "Poukaz zatím není platný — vystavíme ho po zaplacení." })
    return
  }

  try {
    const stored = await storeGiftVoucherPdf(req.scope, await giftVoucherPdfInputFor(req.scope, voucher))
    if (!stored) {
      res.status(502).json({ message: "Poukaz se teď nepodařilo vystavit." })
      return
    }
    res.json({ url: stored.url, filename: stored.filename })
  } catch (error) {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `[poukazy] PDF poukazu ${voucher.code} pro zákazníka selhalo: ${(error as Error)?.message ?? error}`
      )
    res.status(502).json({ message: "Poukaz se teď nepodařilo vystavit. Zkuste to prosím za chvíli." })
  }
}
