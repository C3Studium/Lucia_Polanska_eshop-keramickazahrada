"use client"

import { selectProductionPaymentMode } from "@lib/data/made-to-order-actions"
import type { ProductionPaymentMode } from "@lib/util/made-to-order"
import ProductionPaymentModeChoice from "@modules/checkout/components/production-payment-mode"

type Props = {
  cartId: string
  productionMode: ProductionPaymentMode | null
}

/**
 * Výše zálohy u zakázky — kolik zaplatit hned — rovnou v košíku, kde se zákazník
 * ještě rozhoduje. Brief (popis + fotky) tu VĚDOMĚ není: sbírá se až v pokladně
 * (a v express v kroku doručení), ať košík zůstane o penězích. Majitelčino přání.
 */
export default function CartCommissionBlock({ cartId, productionMode }: Props) {
  if (!productionMode?.has_made_to_order) {
    return null
  }

  return (
    <ProductionPaymentModeChoice
      variant="cart"
      initial={productionMode}
      onSelect={(mode, amount) =>
        selectProductionPaymentMode(cartId, mode, amount)
      }
    />
  )
}
