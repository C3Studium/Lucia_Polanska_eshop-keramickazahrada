import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ICartModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { refreshPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Košík, ve kterém nic nepotřebuje dopravu (jen elektronický dárkový poukaz),
 * nesmí nést dopravu zvolenou dřív — typicky zákazník vybral poštu, pak
 * odebral zboží a zůstal mu jen poukaz. Pokladna krok Doručení skryje, takže
 * by poštovné platil, aniž by ho viděl jako volbu.
 *
 * Maže JEN když žádná položka dopravu nepotřebuje; jinak nedělá nic.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "items.id", "items.requires_shipping", "shipping_methods.id"],
    filters: { id: req.params.id },
  })
  const cart = data[0] as any
  if (!cart) {
    res.status(404).json({ dropped: 0 })
    return
  }

  const items = (cart.items ?? []) as any[]
  const needsShipping = items.some((item) => item?.requires_shipping !== false)
  const methodIds = ((cart.shipping_methods ?? []) as any[])
    .map((method) => method?.id)
    .filter(Boolean) as string[]

  if (!items.length || needsShipping || !methodIds.length) {
    res.json({ dropped: 0 })
    return
  }

  const cartModule = req.scope.resolve<ICartModuleService>(Modules.CART)
  await cartModule.softDeleteShippingMethods(methodIds)
  await refreshPaymentCollectionForCartWorkflow(req.scope)
    .run({ input: { cart_id: cart.id } })
    .catch(() => undefined)

  res.json({ dropped: methodIds.length })
}
