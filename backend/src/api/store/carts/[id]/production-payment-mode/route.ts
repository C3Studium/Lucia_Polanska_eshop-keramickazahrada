import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"

/**
 * Lets checkout choose between paying the deposit and paying everything now.
 *
 * The choice belongs to the **cart**, not to a product: a basket can mix a
 * commission with ordinary stock, and „pay it all now" is one decision about
 * the whole basket. It is stored in `cart.metadata`, which the payment
 * calculation reads when the payment collection is created.
 *
 * `GET` tells the storefront what it may offer and what each option costs, so
 * checkout never has to do the deposit arithmetic itself — the two would drift
 * and the customer would be shown a number they are not charged.
 */

export const PostProductionPaymentModeSchema = z.object({
  mode: z.enum(["deposit", "full"]),
})

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return toNumber(candidate.value ?? candidate.numeric_ ?? candidate.raw_ ?? 0)
  }
  return 0
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

/**
 * What this cart owes under each option, and whether the choice may be offered
 * at all. Mirrors `prepare-made-to-order-payment.ts`; if that ever changes,
 * this has to change with it.
 */
const summarise = async (req: MedusaRequest, cartId: string) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const service = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "total",
      "currency_code",
      "metadata",
      "items.id",
      "items.product_id",
      "items.variant_id",
      "items.quantity",
      "items.unit_price",
      "items.total",
    ],
    filters: { id: cartId },
  })
  const cart = carts[0] as any

  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Košík nebyl nalezen.")
  }

  const items = Array.isArray(cart.items) ? cart.items : []
  const productIds = [
    ...new Set(items.map((item: any) => item.product_id).filter(Boolean)),
  ]
  const variantIds = [
    ...new Set(items.map((item: any) => item.variant_id).filter(Boolean)),
  ]

  const [productProfiles, variantProfiles] = await Promise.all([
    productIds.length
      ? service.listProductProductionProfiles({ product_id: productIds } as never)
      : [],
    variantIds.length
      ? service.listVariantProductionProfiles({ variant_id: variantIds } as never)
      : [],
  ])

  const byProduct = new Map(
    (productProfiles as any[]).map((profile) => [profile.product_id, profile])
  )
  const byVariant = new Map(
    (variantProfiles as any[]).map((profile) => [profile.variant_id, profile])
  )

  let productionTotal = 0
  let depositTotal = 0
  let hasProduction = false
  // Offered only when *every* commission in the basket allows it. Mixed
  // permission would mean a „pay everything" button that does not.
  let allowFull = true

  for (const item of items as any[]) {
    const profile = byProduct.get(item.product_id)
    if (!profile?.enabled) {
      continue
    }
    hasProduction = true
    if (profile.allow_full_prepayment === false) {
      allowFull = false
    }

    const override = byVariant.get(item.variant_id)
    const percentage = Math.min(
      100,
      Math.max(
        1,
        toNumber(
          override?.deposit_percentage_override ??
            profile.default_deposit_percentage ??
            25
        )
      )
    )
    const lineTotal = toNumber(
      item.total ?? toNumber(item.unit_price) * toNumber(item.quantity)
    )
    productionTotal += lineTotal
    depositTotal += roundMoney((lineTotal * percentage) / 100)
  }

  const cartTotal = toNumber(cart.total)
  const mode =
    (cart.metadata as Record<string, unknown> | null)
      ?.production_payment_mode === "full"
      ? "full"
      : "deposit"

  return {
    cart_id: cart.id,
    currency_code: cart.currency_code,
    /** Whether checkout should show the choice at all. */
    has_made_to_order: hasProduction,
    can_pay_full: hasProduction && allowFull,
    mode,
    /** Charged now if the deposit option is taken. */
    deposit_amount: hasProduction
      ? roundMoney(cartTotal - productionTotal + depositTotal)
      : cartTotal,
    /** Charged now if „pay everything" is taken. */
    full_amount: cartTotal,
    /** Owed later under the deposit option — zero when paying in full. */
    balance_later: hasProduction
      ? roundMoney(productionTotal - depositTotal)
      : 0,
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.status(200).json(await summarise(req, req.params.id))
}

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostProductionPaymentModeSchema>>,
  res: MedusaResponse
) => {
  const { mode } = req.validatedBody
  const summary = await summarise(req, req.params.id)

  if (!summary.has_made_to_order) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "V košíku není žádný produkt vyráběný na zakázku."
    )
  }

  if (mode === "full" && !summary.can_pay_full) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "U tohoto produktu není možné zaplatit celou částku předem."
    )
  }

  const cartModule = req.scope.resolve(Modules.CART)
  const [cart] = await cartModule.listCarts(
    { id: req.params.id } as never,
    { take: 1 }
  )

  await cartModule.updateCarts(req.params.id, {
    metadata: {
      ...((cart as any)?.metadata ?? {}),
      production_payment_mode: mode,
    },
  } as never)

  res.status(200).json({ ...(await summarise(req, req.params.id)), mode })
}
