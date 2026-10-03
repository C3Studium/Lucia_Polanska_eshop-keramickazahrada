"use client"

import { addOrderCommissionNote } from "@lib/data/commission-actions"
import type { CommissionNote } from "@lib/util/made-to-order"
import CommissionBrief from "@modules/checkout/components/commission-brief"

/**
 * Deník zakázky na dokončené objednávce.
 *
 * Proč vlastní klientská komponenta: `OrderCompletedTemplate` je serverová (RSC)
 * a serverová komponenta NESMÍ předat klientskému `CommissionBrief` funkci
 * `onSubmitAction` jako prop („Event handlers cannot be passed to Client
 * Component props"). Closure proto vzniká až tady, na klientu; serverová šablona
 * sem posílá jen serializovatelné `orderId` a `notes`.
 */
export default function OrderCommissionDiary({
  orderId,
  notes,
}: {
  orderId: string
  notes: CommissionNote[]
}) {
  return (
    <CommissionBrief
      variant="order"
      note=""
      photos={[]}
      notes={notes}
      onSubmitAction={async (input) =>
        addOrderCommissionNote(orderId, {
          note: input.note,
          newPhotos: input.newPhotos,
        })
      }
    />
  )
}
