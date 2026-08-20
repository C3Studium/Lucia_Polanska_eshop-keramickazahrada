import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

/**
 * The order-edit rules, enforced on the NATIVE admin endpoints.
 *
 * `lib/order-edit-rules` governs the customer's own edit route, but the native
 * admin order-edit API is another door to the same order — and a rule enforced
 * on one door only will eventually be walked around. Two invariants matter
 * here:
 *
 * 1. **Made-to-order lines are not editable.** A commission's price is an
 *    agreement (deposit already computed from it, production order created) —
 *    changing the line under it desynchronises money that has already moved.
 * 2. **An edit must not empty the order.** Zero items with a captured payment
 *    is a refund pretending to be an edit; cancellation is the honest tool.
 *
 * Lookup failures log and let the request through: a broken guard that blocks
 * every legitimate admin edit would be worse than the rare bypass, and the
 * customer route still enforces the full matrix.
 */

/** Blocks quantity updates / removals that touch a made-to-order line. */
export const blockMtoLineEdits = () => {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    try {
      const itemId = req.params.item_id
      if (!itemId) return next()

      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data: items } = await query.graph({
        entity: "order_line_item",
        fields: ["id", "metadata"],
        filters: { id: itemId },
      })
      const item = items[0] as any
      if (item?.metadata?.made_to_order) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Zakázkovou položku nelze upravovat — záloha i výrobní příkaz vychází z dohodnuté ceny. Použijte storno zakázky."
        )
      }
      return next()
    } catch (error) {
      if (error instanceof MedusaError) throw error
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(`Order-edit guard lookup failed, letting the request through: ${error}`)
      return next()
    }
  }
}

/** Blocks ADDING a commission product through a native order edit — a zakázka
 *  enters an order only through the checkout, where the deposit is computed. */
export const blockMtoVariantAdds = () => {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    try {
      const items = ((req.body as Record<string, unknown>)?.items ?? []) as Array<{
        variant_id?: string
      }>
      const variantIds = items.map((item) => item?.variant_id).filter(Boolean) as string[]
      if (!variantIds.length) return next()

      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data: variants } = await query.graph({
        entity: "variant",
        fields: ["id", "product.title", "product.categories.handle"],
        filters: { id: variantIds },
      })
      const commission = (variants as any[]).find((variant) =>
        (variant?.product?.categories ?? []).some(
          (category: any) => category?.handle === "zakazkova-vyroba"
        )
      )
      if (commission) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `„${commission.product?.title ?? "Zakázkový produkt"}" nejde přidat úpravou objednávky — zakázka vzniká jen přes košík, kde se spočítá záloha.`
        )
      }
      return next()
    } catch (error) {
      if (error instanceof MedusaError) throw error
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(`Order-edit guard lookup failed, letting the request through: ${error}`)
      return next()
    }
  }
}

/** Blocks confirming an edit whose preview leaves the order with zero items. */
export const blockEmptyingConfirm = () => {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    try {
      const changeId = req.params.id
      if (!changeId) return next()

      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data: changes } = await query.graph({
        entity: "order_change",
        fields: ["id", "order_id"],
        filters: { id: changeId },
      })
      const orderId = (changes[0] as any)?.order_id
      if (!orderId) return next()

      const orderModule = req.scope.resolve(Modules.ORDER) as any
      const preview = await orderModule.previewOrderChange(orderId)
      const items = (preview?.items ?? []) as any[]
      const toNumber = (value: unknown) =>
        Number(
          typeof value === "object" && value !== null
            ? ((value as any).value ?? 0)
            : value
        ) || 0
      const remaining = items.reduce(
        (sum, item) => sum + toNumber(item?.quantity),
        0
      )
      if (items.length > 0 && remaining <= 0) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Úprava by objednávku úplně vyprázdnila. Prázdná objednávka je storno — použijte zrušení objednávky, ať se vyrovnají peníze."
        )
      }
      return next()
    } catch (error) {
      if (error instanceof MedusaError) throw error
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(`Order-edit guard lookup failed, letting the request through: ${error}`)
      return next()
    }
  }
}
