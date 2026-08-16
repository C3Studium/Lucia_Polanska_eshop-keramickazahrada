"use client"

import { saveCommissionBrief } from "@lib/data/commission-actions"
import { selectProductionPaymentMode } from "@lib/data/made-to-order-actions"
import type {
  CommissionBrief as CommissionBriefData,
  ProductionPaymentMode,
} from "@lib/util/made-to-order"
import CommissionBrief from "@modules/checkout/components/commission-brief"
import ProductionPaymentModeChoice from "@modules/checkout/components/production-payment-mode"

export type CartCommissionLine = {
  id: string
  title: string
  brief: CommissionBriefData
}

type Props = {
  cartId: string
  lines: CartCommissionLine[]
  productionMode: ProductionPaymentMode | null
}

/**
 * Everything a commission needs from the customer, together in the basket: the description
 * with its photos (per commissioned line), and below it how much of the total to pay now.
 * The product page only announces the terms; this is where the zakázka is actually briefed —
 * whatever is written and chosen here is what checkout opens on.
 */
export default function CartCommissionBlock({
  cartId,
  lines,
  productionMode,
}: Props) {
  return (
    <>
      {lines.map((line) => (
        <CommissionBrief
          key={line.id}
          variant="checkout"
          title={line.title}
          // The text is the specification; older lines may still carry it as `note`.
          note={line.brief.specification || line.brief.note || ""}
          photos={line.brief.photos ?? []}
          onSubmitAction={async (input) => saveCommissionBrief(line.id, input)}
        />
      ))}

      {productionMode?.has_made_to_order && (
        <ProductionPaymentModeChoice
          variant="cart"
          initial={productionMode}
          onSelect={(mode, amount) =>
            selectProductionPaymentMode(cartId, mode, amount)
          }
        />
      )}
    </>
  )
}
