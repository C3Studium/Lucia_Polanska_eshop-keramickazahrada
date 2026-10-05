"use client"

import { commissionPrompt, isMadeToOrderLine } from "@lib/util/commission"
import { readCommissionBrief } from "@lib/util/made-to-order"
import { saveCommissionBrief } from "@lib/data/commission-actions"
import CommissionBrief from "../commission-brief"

/**
 * The commission brief(s) for a checkout cart — one box per zakázka line, where
 * the customer writes what they want and attaches photos.
 *
 * Extracted so it can live in two places at once: the right summary column on a
 * wide screen (next to „Co objednáváte"), and inside the Přehled step on a phone
 * (in the flow). CSS at each site decides which one is visible — see the two
 * wrappers. The brief saves onto the cart line; the Přehled's gate reads that
 * saved content back from the cart, so it does not matter which copy saved it.
 */
export default function CheckoutCommissionBriefs({ cart }: { cart: any }) {
  const commissionLines = ((cart?.items ?? []) as any[])
    .filter(isMadeToOrderLine)
    .map((item) => ({
      id: item.id as string,
      title: (item.product_title || item.title) as string,
      prompt: commissionPrompt(item),
      brief: readCommissionBrief(item),
    }))

  if (!commissionLines.length) {
    return null
  }

  return (
    <>
      {commissionLines.map((line) => (
        <CommissionBrief
          key={line.id}
          variant="checkout"
          title={line.title}
          prompt={line.prompt}
          // The text is the specification; older lines may still carry it as `note`.
          note={line.brief.specification || line.brief.note || ""}
          photos={line.brief.photos ?? []}
          onSubmitAction={async (input) => saveCommissionBrief(line.id, input)}
        />
      ))}
    </>
  )
}
