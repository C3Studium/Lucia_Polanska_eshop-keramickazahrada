/**
 * Doběrečné — the cash-on-delivery surcharge, as one cart line item.
 *
 * ## Why a line item and not a shipping adjustment
 *
 * A line item flows through every downstream consumer without any of them
 * learning the fee exists: `order.total` includes it (so the ČP dobírka
 * amount stamped by `stamp-dobirka.ts` includes it), the order e-mails render
 * it as one more row, and the iDoklad invoice builder walks `order.items` and
 * prints it as its own honest line. A shipping-method adjustment would need
 * special-casing in the invoice split (Poštovné/Balné) and in every recap.
 *
 * ## Why the trigger is the payment-session route, and why it cannot be
 * bypassed
 *
 * The fee must exist the moment dobírka is *chosen*, so the customer sees the
 * surcharge before confirming. In Medusa the only way any checkout — classic,
 * express, or a hand-written HTTP client — can choose a payment provider is
 * `POST /store/payment-collections/:id/payment-sessions`: an order cannot
 * complete without a payment session, and payment sessions are created
 * nowhere else. The middleware below runs *before* the core handler, adjusts
 * the cart, and re-syncs the payment collection amount, so the session that
 * gets created is already priced with (or without) the fee.
 *
 * Two backstops close the remaining gaps:
 *
 * - the line-item routes refuse to touch a fee line (a crafted DELETE would
 *   otherwise remove it), and
 * - `validate-dobirka.ts` re-checks at completion that a dobírka cart carries
 *   exactly one fee line — the one moment nothing can be snuck past.
 *
 * The fee amount is the merchant setting `dobirka_fee_czk` (default 39 Kč,
 * editable in the admin without a deploy). Zero switches the fee off.
 */

import type {
  ICartModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { refreshPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"
import { getMerchantSetting } from "./merchant-settings"
import { DOBIRKA_PROVIDER_ID } from "./ship-gate"

/** Line-item metadata marker. The one fact every guard keys on. */
export const DOBIRKA_FEE_MARKER = "dobirka_fee"

/** What the customer reads — in the cart, the e-mail and on the invoice. */
export const DOBIRKA_FEE_TITLE = "Doběrečné"

export type FeeLineLike = {
  id?: string
  quantity?: unknown
  unit_price?: unknown
  metadata?: Record<string, unknown> | null
  variant_id?: string | null
  product_id?: string | null
}

/**
 * A fee line is the marker AND no product behind it — both, on purpose.
 *
 * The marker alone is forgeable: every store line-item route (native add,
 * update, line-items-custom, bundles) accepts client-supplied `metadata`, so
 * anyone can stamp `dobirka_fee: true` onto an ordinary product line. If the
 * marker alone decided, that forged line would (a) get re-priced to 39 Kč by
 * `planDobirkaFee` — a 2000Kč vase for the price of the fee — and (b) skip
 * the per-product `cod_allowed` check in `validate-dobirka`. But every
 * client-reachable route requires a `variant_id`, while the real fee line is
 * created by `syncDobirkaFeeForCart` with no variant and no product. The pair
 * of facts is unforgeable from outside; a stray marker on a product line is
 * inert.
 */
export const isDobirkaFeeLine = (item: FeeLineLike | null | undefined): boolean =>
  Boolean(item?.metadata?.[DOBIRKA_FEE_MARKER]) &&
  !item?.variant_id &&
  !item?.product_id

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Whether the fee belongs on this cart at all. The currency guard mirrors the
 * dobírka rules themselves: the service is Czech-only, so a non-CZK cart never
 * gets a CZK fee silently converted to the wrong currency.
 */
export const dobirkaFeeApplies = (input: {
  usesDobirka: boolean
  currencyCode?: string | null
  feeCzk: number
}): boolean =>
  input.usesDobirka &&
  String(input.currencyCode ?? "").toLowerCase() === "czk" &&
  input.feeCzk > 0

export type DobirkaFeePlan = {
  /** Add one fee line at this price. `null` when nothing needs adding. */
  add: { unit_price: number } | null
  /** Fee lines to delete — duplicates always, all of them on switch-away. */
  remove_ids: string[]
  /** Re-price/fix the surviving line (setting changed, or quantity drifted). */
  update: { id: string; unit_price: number } | null
}

/**
 * Pure planner: given the provider being selected and the cart's items,
 * decides what has to change so the cart holds exactly one fee line when it
 * should and none when it should not. Idempotent by construction — a plan
 * computed on an already-correct cart is all `null`s and empty arrays.
 */
export const planDobirkaFee = (input: {
  providerId: string
  currencyCode?: string | null
  feeCzk: number
  items: FeeLineLike[]
}): DobirkaFeePlan => {
  const feeLines = (input.items ?? []).filter(isDobirkaFeeLine)
  const applies = dobirkaFeeApplies({
    usesDobirka: input.providerId === DOBIRKA_PROVIDER_ID,
    currencyCode: input.currencyCode,
    feeCzk: input.feeCzk,
  })

  if (!applies) {
    return {
      add: null,
      remove_ids: feeLines.map((line) => String(line.id)).filter(Boolean),
      update: null,
    }
  }

  const [kept, ...extras] = feeLines
  const removeIds = extras.map((line) => String(line.id)).filter(Boolean)

  if (!kept) {
    return { add: { unit_price: input.feeCzk }, remove_ids: removeIds, update: null }
  }

  const priceOk = Math.abs(toNumber(kept.unit_price) - input.feeCzk) < 0.005
  const quantityOk = toNumber(kept.quantity) === 1

  return {
    add: null,
    remove_ids: removeIds,
    update:
      priceOk && quantityOk
        ? null
        : { id: String(kept.id), unit_price: input.feeCzk },
  }
}

/**
 * The completion-time verdict, in Czech, or `null` when the cart is sound.
 * Deliberately does NOT compare the fee's price against the current setting:
 * the customer confirmed the price that was on screen, and the owner changing
 * the setting mid-checkout must never brick an order in flight.
 */
export const dobirkaFeeCompletionProblem = (input: {
  usesDobirka: boolean
  currencyCode?: string | null
  feeCzk: number
  items: FeeLineLike[]
}): string | null => {
  const feeLines = (input.items ?? []).filter(isDobirkaFeeLine)

  if (!input.usesDobirka) {
    return feeLines.length
      ? "Košík obsahuje doběrečné, ale platba dobírkou není zvolená. Vraťte se prosím o krok zpět a zvolte způsob platby znovu."
      : null
  }

  if (feeLines.length > 1 || feeLines.some((line) => toNumber(line.quantity) !== 1)) {
    return "Doběrečné je v košíku vícekrát. Vraťte se prosím o krok zpět a zvolte způsob platby znovu."
  }

  const shouldHaveFee = dobirkaFeeApplies({
    usesDobirka: true,
    currencyCode: input.currencyCode,
    feeCzk: input.feeCzk,
  })
  if (shouldHaveFee && feeLines.length === 0) {
    return "K platbě na dobírku patří doběrečné, které v košíku chybí. Vraťte se prosím o krok zpět a zvolte způsob platby znovu."
  }

  return null
}

/**
 * Applies the plan to a real cart and, when anything changed, re-syncs the
 * payment collection so the session about to be created carries the new total.
 */
export const syncDobirkaFeeForCart = async (
  container: MedusaContainer,
  cartId: string,
  providerId: string
): Promise<{ changed: boolean }> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "currency_code",
      "items.id",
      "items.quantity",
      "items.unit_price",
      "items.metadata",
      // Both feed the fee-line identity: marker + no product behind the line.
      "items.variant_id",
      "items.product_id",
    ],
    filters: { id: cartId },
  })
  const cart = carts[0] as any
  if (!cart) {
    return { changed: false }
  }

  // The setting is only needed when it can matter; a non-dobírka switch just
  // removes whatever fee lines exist.
  const feeCzk =
    providerId === DOBIRKA_PROVIDER_ID
      ? await getMerchantSetting(container, "dobirka_fee_czk")
      : 0

  const plan = planDobirkaFee({
    providerId,
    currencyCode: cart.currency_code,
    feeCzk,
    items: (cart.items ?? []) as FeeLineLike[],
  })

  const cartModule = container.resolve<ICartModuleService>(Modules.CART)
  let changed = false

  if (plan.remove_ids.length) {
    await cartModule.deleteLineItems(plan.remove_ids)
    changed = true
  }
  if (plan.update) {
    await cartModule.updateLineItems(plan.update.id, {
      unit_price: plan.update.unit_price,
      quantity: 1,
    })
    changed = true
  }
  if (plan.add) {
    await cartModule.addLineItems([
      {
        cart_id: cartId,
        title: DOBIRKA_FEE_TITLE,
        quantity: 1,
        unit_price: plan.add.unit_price,
        // Custom price: the cart refresh flows must never try to re-price
        // this against a variant price list — there is no variant.
        is_custom_price: true,
        is_discountable: false,
        // Nothing to pack: keeps the line out of fulfilment item lists.
        requires_shipping: false,
        metadata: { [DOBIRKA_FEE_MARKER]: true },
      },
    ])
    changed = true
  }

  if (changed) {
    // Sync the payment collection amount with the new cart total (and drop
    // stale sessions) BEFORE the core route creates the requested session.
    await refreshPaymentCollectionForCartWorkflow(container).run({
      input: { cart_id: cartId },
    })
  }

  return { changed }
}

/**
 * Middleware for `POST /store/payment-collections/:id/payment-sessions` —
 * the single door through which any checkout selects a payment provider.
 * Runs before the core handler, so the session is created against a cart that
 * already holds (or no longer holds) the fee.
 */
export const applyDobirkaFeeOnPaymentSession = () => {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    try {
      const providerId = String((req.body as any)?.provider_id ?? "")
      if (!providerId) {
        return next()
      }

      // The cart behind this payment collection, through the link entity —
      // the same traversal Medusa's own process-payment workflow uses.
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "cart_payment_collection",
        fields: ["cart_id"],
        filters: { payment_collection_id: req.params.id },
      })
      const cartId = (data[0] as any)?.cart_id
      if (!cartId) {
        // Not a cart's payment collection — nothing for the fee to do.
        return next()
      }

      await syncDobirkaFeeForCart(req.scope, cartId, providerId)
      next()
    } catch (error) {
      // Fail loudly: a session silently created without the fee would let a
      // dobírka order underpay, and one with a stale fee would overcharge.
      next(error)
    }
  }
}

/**
 * Middleware for the line-item routes: the fee line is not the customer's to
 * edit or delete. It appears and disappears with the payment choice only.
 *
 * The same door also handles the fee's one loose end: removing the last real
 * product from a dobírka cart. Without the cascade below, the cart would keep
 * showing a control-free 39Kč fee row with nothing to pay it for — the
 * customer cannot delete it (that is the point of this guard) and nothing
 * else would, until the next payment selection.
 */
export const protectDobirkaFeeLine = () => {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    try {
      const lineId = req.params.line_id
      if (!lineId) {
        return next()
      }

      const cartModule = req.scope.resolve<ICartModuleService>(Modules.CART)
      const items = (await cartModule.listLineItems(
        { cart_id: req.params.id },
        { select: ["id", "metadata", "variant_id", "product_id"] }
      )) as FeeLineLike[]
      // By id, not from the cart's list: the guard must hold even for a line
      // id addressed through a different cart's URL.
      const [line] = (await cartModule.listLineItems(
        { id: lineId },
        { select: ["id", "metadata", "variant_id", "product_id"] }
      )) as FeeLineLike[]

      if (line && isDobirkaFeeLine(line)) {
        res.status(400).json({
          type: "not_allowed",
          message:
            "Doběrečné patří k platbě na dobírku a nedá se upravit. Když zvolíte jiný způsob platby, zmizí samo.",
        })
        return
      }

      /*
       * Removing the last real product takes the fee with it. Covers DELETE
       * and the native update route's `quantity: 0` (which is a removal in
       * disguise). Removing the fee first is safe even if the handler then
       * fails: the fee is re-added at the next payment selection, and a
       * dobírka completion without it is refused by `validate-dobirka`.
       * The handler's own workflow re-syncs the payment collection amount.
       */
      const isRemoval =
        req.method === "DELETE" ||
        (req.method === "POST" && Number((req.body as any)?.quantity) === 0)
      const lineIsInCart = items.some(
        (item) => String(item.id) === String(lineId)
      )
      if (isRemoval && lineIsInCart) {
        const feeIds = items
          .filter(isDobirkaFeeLine)
          .map((item) => String(item.id))
        const productLinesLeft = items.filter(
          (item) =>
            !isDobirkaFeeLine(item) && String(item.id) !== String(lineId)
        )
        if (feeIds.length && !productLinesLeft.length) {
          await cartModule.deleteLineItems(feeIds)
        }
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
