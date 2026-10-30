import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  refreshPaymentCollectionForCartWorkflow,
  updateLineItemInCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { z } from "@medusajs/framework/zod"
import {
  giftVoucherSetup,
  isGiftVoucherProduct,
  VOUCHER_DEDICATION_MAX,
  VOUCHER_EMAIL_MAX,
  VOUCHER_RECIPIENT_NAME_MAX,
} from "../../../../../../../lib/voucher"

/**
 * Nastavení dárkového poukazu, který už leží v košíku (30. 10. 2026).
 *
 * Hodnota, podoba a obdarovaný se vyplňují až tady — do košíku se poukaz
 * přidá holý. Cesta dělá tři věci naráz, protože patří k sobě:
 *
 * 1. uloží metadata položky (odtud je po zaplacení přečte
 *    `lib/gift-voucher-orders.ts` a založí z nich poukaz),
 * 2. u poukazu s vlastní částkou přepíše CENU řádku na zvolenou hodnotu,
 * 3. srovná `requires_shipping` — elektronický poukaz chodí e-mailem, takže
 *    položka dopravu nepotřebuje a pokladna krok Doručení přeskočí.
 *
 * Pravidla sama leží v `lib/voucher.ts` (`giftVoucherSetup`), aby brána před
 * dokončením košíku odmítala přesně to, co tahle cesta neuloží.
 */

export const PostGiftVoucherLineSchema = z.object({
  kind: z.enum(["electronic", "physical"]),
  /** Jen u poukazu s vlastní částkou; meze hlídá `giftVoucherSetup`. */
  amount: z.union([z.number(), z.string()]).optional().nullable(),
  recipient_name: z.string().max(VOUCHER_RECIPIENT_NAME_MAX).optional().nullable(),
  recipient_email: z.string().max(VOUCHER_EMAIL_MAX).optional().nullable(),
  dedication: z.string().max(VOUCHER_DEDICATION_MAX).optional().nullable(),
})

type PostGiftVoucherLineSchemaType = z.infer<typeof PostGiftVoucherLineSchema>

export async function POST(
  req: MedusaRequest<PostGiftVoucherLineSchemaType>,
  res: MedusaResponse
) {
  const cartId = req.params.id
  const lineId = req.params.line_id

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "currency_code",
      "completed_at",
      "items.id",
      "items.metadata",
      "items.product.metadata",
    ],
    filters: { id: cartId },
  })
  const cart = data[0] as any
  if (!cart || cart.completed_at) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Košík už není k dispozici.")
  }

  const line = ((cart.items ?? []) as any[]).find((item) => item?.id === lineId)
  if (!line) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Položka v košíku není.")
  }
  if (!isGiftVoucherProduct(line.product?.metadata)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Tahle položka není dárkový poukaz."
    )
  }

  const setup = giftVoucherSetup(req.validatedBody, {
    productMetadata: line.product?.metadata,
    currencyCode: cart.currency_code,
  })
  // `in`, ne `!setup.ok`: backend nemá `strict`, takže booleovský diskriminant
  // union nezúží (tatáž past jako u `voucherLineProblem`).
  if ("message" in setup) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, setup.message)
  }

  await updateLineItemInCartWorkflow(req.scope).run({
    input: {
      cart_id: cartId,
      item_id: lineId,
      update: {
        metadata: setup.metadata,
        requires_shipping: setup.requiresShipping,
        // Poukaz s pevnou hodnotou si nechává cenu z ceníku.
        ...(setup.unitPrice === null ? {} : { unit_price: setup.unitPrice }),
      },
    } as never,
  })

  /* Kdo se vrátil z pokladny, už může mít rozdělanou platební kolekci na
     starou částku — po změně hodnoty poukazu by platil jinou sumu, než vidí. */
  await refreshPaymentCollectionForCartWorkflow(req.scope)
    .run({ input: { cart_id: cartId } })
    .catch(() => undefined)

  res.json({ ok: true, kind: setup.kind })
}
