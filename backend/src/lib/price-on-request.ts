import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * „Cena po domluvě" — výrobek, u kterého se cena sjednává až podle zadání
 * (Domovní znamení na zakázku, rozhodnutí Lucie 20.–21. 10. 2026).
 *
 * Jediný zdroj pravdy je `product.metadata.price_on_request === true`
 * (přepínač v administraci → `/admin/workbench/products/:id/flags`).
 * Storefront podle něj ukazuje „Cena po domluvě" a místo košíku vede na
 * poptávku (`/vyroba?produkt=<handle>#poptavka`); tady se totéž vynucuje na
 * serveru, protože do košíku se dá poslat i bez tlačítka. Kus s touto
 * vlajkou nemá v košíku co dělat ani tehdy, když mu v administraci zůstala
 * stará cena — nabídka vzniká až po domluvě (OP čl. IX, zakázka).
 */
export const PRICE_ON_REQUEST_KEY = "price_on_request"

export const isPriceOnRequest = (
  metadata: Record<string, unknown> | null | undefined
): boolean => metadata?.[PRICE_ON_REQUEST_KEY] === true

export const PRICE_ON_REQUEST_MESSAGE =
  "Tento výrobek má cenu po domluvě a do košíku nejde vložit. Pošlete nám poptávku na stránce Výroba — připravíme nabídku s cenou, lhůtou a výší zálohy."

/**
 * Strážce přidání do košíku (`POST /store/carts/:id/line-items` i
 * `…/line-items-custom`): varianta výrobku s cenou po domluvě se odmítne
 * srozumitelnou českou hláškou místo Medusa „Variants do not have a price".
 */
export const rejectPriceOnRequestLine = () => {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    try {
      const variantId = (req.body as { variant_id?: unknown } | undefined)
        ?.variant_id
      if (typeof variantId !== "string" || !variantId) {
        return next()
      }
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "variant",
        fields: ["id", "product.metadata"],
        filters: { id: variantId },
      })
      const product = (data?.[0] as { product?: { metadata?: Record<string, unknown> | null } } | undefined)
        ?.product
      if (product && isPriceOnRequest(product.metadata)) {
        res.status(400).json({
          type: "not_allowed",
          message: PRICE_ON_REQUEST_MESSAGE,
        })
        return
      }
      return next()
    } catch (error) {
      return next(error)
    }
  }
}
