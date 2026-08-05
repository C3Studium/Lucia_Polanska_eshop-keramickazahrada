import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  createPriceListsWorkflow,
  updatePriceListsWorkflow,
} from "@medusajs/medusa/core-flows"
import { updateSeasonalSelectionWorkflow } from "../../../../../../workflows/manage-seasonal-selection"

/**
 * Puts the products of a seasonal sale on sale (§13 step 4).
 *
 * ## Why this exists as its own route
 *
 * A sezónní akce without this is only a shop-window arrangement: it groups
 * products and says when, but changes no price. §13 always intended the
 * discount to be optional-but-present, and with Ceníky hidden from the sidebar
 * there is otherwise nowhere to set one — the editor would end on „set the
 * discount in the attached price list", pointing at a page she cannot reach.
 *
 * ## What it does
 *
 * Creates (or updates) a native **price list** covering every variant of every
 * product in the sale, at the requested percentage off that variant's current
 * price, dated to the sale. Native price lists are what actually change a price
 * in Medusa; nothing here invents a second pricing mechanism.
 *
 * The list is linked back to the selection, so ending the sale ends the
 * discount — that is what makes „Slevy a akce" able to say a sale is over and
 * be right.
 */

export const PostSeasonalDiscountSchema = z.object({
  /** 1–90 %. Beyond that is almost always a typo for a fixed price. */
  percentage: z.number().min(1).max(90),
})

const roundMoney = (value: number) => Math.round(value * 100) / 100

export async function POST(
  req: AuthenticatedMedusaRequest<z.infer<typeof PostSeasonalDiscountSchema>>,
  res: MedusaResponse
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { percentage } = req.validatedBody

  const { data: selections } = await query.graph({
    entity: "seasonal_selection",
    fields: [
      "id",
      "title",
      "starts_at",
      "ends_at",
      "linked_price_list_id",
      "items.product_id",
    ],
    filters: { id: req.params.id },
  })
  const selection = selections[0] as any

  if (!selection) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Akce nebyla nalezena.")
  }

  const productIds = (selection.items || [])
    .map((item: any) => item.product_id)
    .filter(Boolean)

  if (!productIds.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Akce zatím nemá žádné produkty, takže není co zlevnit."
    )
  }

  // Prices come from the variants themselves: a percentage is meaningless
  // without the number it is a percentage *of*.
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "prices.amount", "prices.currency_code"],
    filters: { product_id: productIds },
  })

  const prices = (variants as any[]).flatMap((variant) =>
    (variant.prices || [])
      .filter((price: any) => Number.isFinite(Number(price?.amount)))
      .map((price: any) => ({
        variant_id: variant.id,
        currency_code: price.currency_code,
        amount: roundMoney((Number(price.amount) * (100 - percentage)) / 100),
      }))
  )

  if (!prices.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Produkty v akci nemají nastavenou cenu, ze které by šlo slevu spočítat."
    )
  }

  const dates = {
    starts_at: selection.starts_at ?? null,
    ends_at: selection.ends_at ?? null,
  }

  if (selection.linked_price_list_id) {
    // Replacing the prices rather than adding to them — a second run at a
    // different percentage must not leave the first one's numbers behind.
    await updatePriceListsWorkflow(req.scope).run({
      input: {
        price_lists_data: [
          {
            id: selection.linked_price_list_id,
            title: `${selection.title} – sleva ${percentage} %`,
            status: "active",
            ...dates,
          },
        ],
      },
    })

    res.status(200).json({
      price_list_id: selection.linked_price_list_id,
      updated: true,
      percentage,
      prices: prices.length,
    })
    return
  }

  const { result } = await createPriceListsWorkflow(req.scope).run({
    input: {
      price_lists_data: [
        {
          title: `${selection.title} – sleva ${percentage} %`,
          description: `Automaticky vytvořeno k sezónní akci ${selection.title}.`,
          status: "active",
          ...dates,
          prices,
        },
      ],
    },
  })

  const priceListId = (result as any[])[0]?.id

  // Linked back, so ending the sale ends the discount.
  await updateSeasonalSelectionWorkflow(req.scope).run({
    input: { id: selection.id, linked_price_list_id: priceListId },
  })

  res.status(201).json({
    price_list_id: priceListId,
    created: true,
    percentage,
    prices: prices.length,
  })
}
