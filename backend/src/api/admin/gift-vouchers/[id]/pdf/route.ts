import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GIFT_VOUCHER_MODULE } from "../../../../../modules/gift-voucher"
import type GiftVoucherModuleService from "../../../../../modules/gift-voucher/service"
import {
  generateGiftVoucherPdf,
  generateGiftVoucherPrintPdf,
  giftVoucherPdfFilename,
  giftVoucherPdfInputFor,
  giftVoucherPrintPdfFilename,
  storeGiftVoucherPdf,
} from "../../../../../lib/gift-voucher-pdf"

/**
 * Vystavení poukazu jako PDF pro administraci — stránka Poukazy i widget pod
 * objednávkou. Vrací soubor v base64 (stejně jako podací štítek, viz
 * `admin/lib/stitky.ts`): nové okno v administraci nenese přihlášení, takže
 * odkaz na chráněnou routu by skončil na 401, kdežto blob z base64 se otevře
 * vždycky.
 *
 * Vedle toho se PDF uloží do úložiště a vrátí se i jeho adresa — tatáž, kterou
 * dostane zákazník v e-mailu. Uložení je ale jen vedlejší: když selže (lokální
 * disk bez pevných klíčů), stažení v administraci funguje dál.
 *
 * Vystavuje se vždy načerstvo z dnešních údajů: po opravě věnování nebo
 * prodloužení platnosti musí mít majitelka v ruce opravený poukaz, ne ten,
 * který jednou odešel e-mailem.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const service = req.scope.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const [voucher] = (await service.listGiftVouchers({ id: req.params.id } as never)) as any[]
  if (!voucher) {
    res.status(404).json({ message: "Poukaz nebyl nalezen." })
    return
  }

  try {
    const input = await giftVoucherPdfInputFor(req.scope, voucher)
    /* `?format=print` = list k oboustrannému tisku (líc a rub kartičky). */
    const print = req.query.format === "print"
    const bytes = print
      ? await generateGiftVoucherPrintPdf(input)
      : await generateGiftVoucherPdf(input)
    const stored = await storeGiftVoucherPdf(
      req.scope,
      input,
      print ? "print" : "summary"
    ).catch((error) => {
      logger.warn(
        `[poukazy] PDF poukazu ${voucher.code} se nepodařilo uložit: ${(error as Error)?.message ?? error}`
      )
      return null
    })
    res.json({
      filename: print
        ? giftVoucherPrintPdfFilename(input.code)
        : giftVoucherPdfFilename(input.code),
      pdf_base64: Buffer.from(bytes).toString("base64"),
      url: stored?.url ?? null,
    })
  } catch (error) {
    logger.error(
      `[poukazy] PDF poukazu ${voucher.code} se nepodařilo vystavit: ${(error as Error)?.message ?? error}`
    )
    res.status(502).json({ message: "Poukaz se teď nepodařilo vystavit. Zkuste to prosím za chvíli." })
  }
}
