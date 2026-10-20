import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  isVerifiedPurchase,
  type PurchaseOrderLike,
} from "../../modules/product-review/verified-purchase"

/**
 * Koupil recenzent výrobek u nás? Výsledek jde do `review.verified_purchase`
 * a jen podle něj storefront ukáže štítek „Ověřený nákup" (§ 5 ZOS).
 *
 * Rozhoduje server, ne formulář — routa `POST /store/reviews` pole vůbec
 * nepřijímá. Pravidlo (účet nebo ověřený e-mail, nezrušená objednávka
 * s řádkem výrobku) je v `modules/product-review/verified-purchase.ts`.
 *
 * Chyba dotazu recenzi nezastaví: neověřená recenze je pravdivý stav, jen
 * bez štítku. Majitelka ji pak schvaluje jako každou jinou.
 */

export type VerifyReviewPurchaseInput = {
  product_id: string
  customer_id?: string | null
}

const ORDER_FIELDS = ["id", "status", "is_draft_order", "email", "items.product_id"]

export const resolveVerifiedPurchase = async (
  container: MedusaContainer,
  input: VerifyReviewPurchaseInput
): Promise<boolean> => {
  if (!input.customer_id || !input.product_id) return false

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: accountOrders } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { customer_id: input.customer_id },
  })

  if (
    isVerifiedPurchase({
      product_id: input.product_id,
      account_orders: accountOrders as PurchaseOrderLike[],
    })
  ) {
    return true
  }

  // Host, který si účet založil až po nákupu: jen s ověřeným e-mailem.
  const customer = await container
    .resolve(Modules.CUSTOMER)
    .retrieveCustomer(input.customer_id)
    .catch(() => null)
  const email = customer?.email?.trim()
  const emailVerified =
    (customer?.metadata as Record<string, unknown> | null)?.email_verified === true
  if (!email || !emailVerified) return false

  const { data: emailOrders } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    // ilike kvůli velikosti písmen; přesnou shodu adresy hlídá
    // `isVerifiedPurchase` (podtržítko v adrese je v LIKE zástupný znak).
    filters: { email: { $ilike: email } } as never,
  })

  return isVerifiedPurchase({
    product_id: input.product_id,
    account_orders: [],
    customer_email: email,
    email_verified: emailVerified,
    email_orders: emailOrders as PurchaseOrderLike[],
  })
}

export const verifyReviewPurchaseStep = createStep(
  "verify-review-purchase",
  async (input: VerifyReviewPurchaseInput, { container }) => {
    try {
      return new StepResponse(await resolveVerifiedPurchase(container, input))
    } catch (error) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `[reviews] Nákup se nepodařilo ověřit, recenze bude bez štítku: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      return new StepResponse(false)
    }
  }
)
