import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { verifyOrderAccessToken } from "../../../../../lib/order-access-link"

/**
 * Předvyplnění stránky reklamace / vrácení / odstoupení (`/order/:id/refund`)
 * z e-mailového odkazu — BEZ přihlášení, autorizace podepsaným tokenem.
 *
 * Vrací jen to, co stránka potřebuje: číslo objednávky a e-mail (aby mohla
 * podat žádost do veřejného intake `/store/return-requests`, kde je číslo+e-mail
 * důkazem vlastnictví — token už ho prokázal), datum převzetí (14denní lhůta) a
 * u každé položky, jestli je to zakázka na míru. Zakázka na míru je ze zákona
 * (§1837) z 14denního odstoupení VYŇATA — proto to stránka u ní nenabídne.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id
  if (!verifyOrderAccessToken(orderId, req.query.token)) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Odkaz je neplatný nebo vypršel. Otevřete prosím ten z posledního e-mailu, nebo se nám ozvěte."
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "created_at",
      "currency_code",
      "items.id",
      "items.title",
      "items.product_title",
      "items.quantity",
      "items.metadata",
      "items.product.metadata",
    ],
    filters: { id: orderId },
  })
  const order = orders[0] as any
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }

  const items = (order.items ?? []).map((item: any) => {
    const madeToOrder =
      Boolean((item.metadata as any)?.made_to_order) ||
      Boolean((item.product?.metadata as any)?.made_to_order)
    return {
      id: item.id,
      title: item.product_title || item.title,
      quantity: item.quantity,
      is_made_to_order: madeToOrder,
    }
  })

  res.status(200).json({
    order_display_id: String(order.display_id),
    email: order.email,
    created_at: order.created_at,
    currency_code: order.currency_code,
    items,
    // Když je VŠE na míru, 14denní odstoupení se nenabízí (§1837). U smíšené
    // objednávky se nabídne (platí na běžné zboží).
    all_made_to_order: items.length > 0 && items.every((i: any) => i.is_made_to_order),
  })
}
