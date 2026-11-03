import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getLoyaltySettings, issueManualLoyaltyCode } from "../../../../../../lib/loyalty-code"
import { parseLoyaltyCodeBody } from "../loyalty-code/route"

/**
 * „Poděkovat" — starší adresa ručního slevového kódu.
 *
 * Od 3. 11. 2026 dělá totéž co `…/loyalty-code` (karta zákazníka →
 * „Poslat slevový kód"): kód jen pro tohoto člověka (pravidlo `customer.id`),
 * aktivní (dřív vznikal jako koncept a obchod ho odmítl), e-mail v jazyce
 * zákazníka. Adresa zůstává, ať nic, co ji volá, nespadne.
 *
 * Původní úvaha (níž) platí dál pro to, proč je to jedna akce.
 *
 * ## Why it is one action and not three
 *
 * Thanking a good customer natively means: open Promotions, invent a code that
 * is not taken, build a campaign so it can only be used once, then go to the
 * customer and write them an e-mail with the code pasted in. Four screens, and
 * the two halves can drift — a code that was never sent, or a mail quoting a
 * code that expired. Here the code is created, capped and sent in one call, or
 * none of it happens.
 *
 * ## What „one time" actually means
 *
 * A usage limit on a promotion in Medusa lives on its **campaign budget**, not
 * on the promotion, so each thank-you gets its own campaign with
 * `budget: { type: "usage", limit: 1 }`. The code is unique per send, so it
 * cannot be forwarded around and spent by a stranger — one code, one customer,
 * one use.
 *
 * ## Kdo rozhoduje
 *
 * Ručně ona: karta ukazuje nákupy a útratu, ona zná člověka za nimi. Automat
 * „po N. zaplacené objednávce" existuje od 3. 11. 2026 jen jako vědomě
 * zapnutá volba (výchozím vypnutý) a jen pro potvrzené odběratele newsletteru.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = parseLoyaltyCodeBody(req.body)
  const defaults = await getLoyaltySettings(req.scope)
  const { code, sentTo } = await issueManualLoyaltyCode(req.scope, {
    customerId: req.params.customerId,
    percentage: body.percentage ?? defaults.percentage,
    validDays: body.valid_days ?? defaults.valid_days,
  })
  res.status(201).json({
    code: code.code,
    percentage: code.percentage,
    expires_at: code.endsAt.toISOString(),
    sent_to: sentTo,
  })
}

