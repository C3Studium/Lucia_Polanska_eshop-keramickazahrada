import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { capturePickupPayment } from "../../../../../lib/pickup-capture"
import { formatMoney } from "../../../../../lib/ship-gate"

/**
 * „Objednávka zaplacena" — zákazník zaplatil u pultu (hotově, převodem,
 * kartou v ateliéru) a peníze se tím zapisují do objednávky.
 *
 * Bez těla, schválně: celá částka, nebo nic. Částečná platba u osobního
 * odběru znamená dvě faktury a dva e-maily, což je jiná úloha (doplatek
 * zakázky, `lib/balance-settlement.ts`). Opakované kliknutí je přátelské
 * „už je zapsáno", ne chyba.
 *
 * Výdej zboží zůstává druhou akcí („Vyzvednuto") — v dílně se ty dvě chvíle
 * často nekryjí a zápis peněz nesmí vyskladnit kus, který si zákazník
 * vyzvedne až příště.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const capturedBy = (req as any).auth_context?.actor_id || null

  const result = await capturePickupPayment(req.scope, req.params.orderId, {
    capturedBy,
  })

  if (result.outcome === "not_found") {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka nebyla nalezena."
    )
  }

  if (result.outcome === "not_pickup") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Tahle objednávka se nevyzvedává osobně — platbu na místě lze zapsat jen u osobního odběru."
    )
  }

  // Dluh bez platby, kterou by šlo zachytit = doplatek zakázky. Ten má vlastní
  // tlačítko, protože k němu patří vlastní faktura i e-mail.
  if (result.outcome === "needs_manual") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Zbývá ${formatMoney(
        result.amount_due,
        result.currency_code
      )}, ke kterým tu není co zachytit — zapište je prosím tlačítkem „Zaplaceno na místě" v panelu zakázky.`
    )
  }

  if (result.outcome === "already") {
    res.status(200).json({
      captured: false,
      message: "Peníze u této objednávky už jsou zapsané.",
    })
    return
  }

  res.status(200).json({ captured: true })
}
