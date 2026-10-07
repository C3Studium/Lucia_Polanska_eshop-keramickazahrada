import type { MedusaContainer } from "@medusajs/framework/types"

import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"

/**
 * Whether any of these products is made to order.
 *
 * The authoritative signal is an **enabled production profile** — the same one
 * the storefront's `has_made_to_order` is built from
 * (`store/carts/:id/production-payment-mode`). Deliberately *not* the
 * `metadata.made_to_order` marker on a cart line: that marker is stamped only
 * once the made-to-order *payment* flow has run (`prepare-made-to-order-payment`),
 * so a cart that tried to pay around the deposit would carry no marker and slip
 * a guard that trusted it.
 *
 * Fails open (returns `false`) if the module is unavailable — the caller is a
 * backstop for a flow the storefront already prevents, so a transient module
 * error must not wall off every checkout.
 */
export const productsHaveMadeToOrder = async (
  container: MedusaContainer,
  productIds: Array<string | null | undefined>
): Promise<boolean> => {
  const ids = [...new Set(productIds.filter(Boolean) as string[])]
  if (!ids.length) {
    return false
  }

  try {
    const service = container.resolve<MadeToOrderModuleService>(
      MADE_TO_ORDER_MODULE
    )
    const profiles = (await service.listProductProductionProfiles({
      product_id: ids,
    } as never)) as Array<{ enabled?: boolean }>

    return profiles.some((profile) => profile?.enabled)
  } catch {
    return false
  }
}
