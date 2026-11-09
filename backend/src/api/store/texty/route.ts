import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getShopTexty } from "../../../lib/merchant-settings"

/**
 * Texty obchodu pro web — věty u výrobku, v košíku, v pokladně a na hotové
 * objednávce (`lib/shop-texty.ts`).
 *
 * Vrací vždycky kompletní sadu: co majitelka nikdy neměnila, přijde ve
 * výchozím znění z kódu. Web tedy nemusí znát výchozí texty a nemůže se
 * stát, že by se obě kopie rozešly — jediný zdroj pravdy je tenhle.
 *
 * Veřejné schválně: jsou to věty, které stejně stojí na stránce výrobku.
 */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const texty = await getShopTexty(_req.scope)

  res.status(200).json({ texty })
}
