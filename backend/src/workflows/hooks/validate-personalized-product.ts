import { MedusaError } from "@medusajs/framework/utils"
import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { voucherLineProblem } from "../../lib/voucher"
import { claimClearanceHolds } from "../../lib/clearance-hold"

// Medusa dovolí na `addToCartWorkflow.hooks.validate` jen JEDEN handler —
// všechny kontroly přidání do košíku proto bydlí tady.
addToCartWorkflow.hooks.validate(
  async (hookInput, { container }) => {
    const { input } = hookInput
    const query = container.resolve("query")
    const { data: variants } = await query.graph({
      entity: "variant",
      fields: ["product.*"],
      filters: {
        id: input.items.map((item) => item.variant_id).filter(Boolean) as string[],
      },
    })
    const currencyCode = (hookInput as { cart?: { currency_code?: string | null } })
      .cart?.currency_code

    for (const item of input.items) {
      const variant = variants.find((v) => v.id === item.variant_id)

      /*
       * Dárkový poukaz s vlastní částkou smí do košíku jen vlastní cestou
       * (`/store/carts/:id/line-items-custom`), která cenu řádku nastaví na
       * zvolenou částku. Standardní `POST /store/carts/:id/line-items` cenu
       * nebere — poukaz by zůstal za katalogovou cenu (1 Kč) s jinou částkou
       * v metadatech. Viz `lib/voucher.ts`.
       */
      const voucherProblem = voucherLineProblem({
        productMetadata: variant?.product?.metadata as Record<string, unknown> | null,
        itemMetadata: item.metadata as Record<string, unknown> | null,
        unitPrice: (item as { unit_price?: unknown }).unit_price,
        currencyCode,
      })
      if (voucherProblem) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, voucherProblem)
      }

      if (!variant?.product?.metadata?.is_personalized) {
        continue
      }
      const height = Number(item.metadata?.height)
      const width = Number(item.metadata?.width)
      // Same bounds as the price route — the price is derived from these
      // numbers, so a negative or absurd dimension is a self-served discount.
      if (
        !Number.isFinite(height) || !Number.isFinite(width) ||
        height <= 0 || width <= 0 || height > 300 || width > 300
      ) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Zadejte prosím výšku a šířku v centimetrech (1–300)."
        )
      }
    }

    /*
     * Poškozený kus: košík si ho rezervuje na 30 minut; když ho má jiný
     * košík, přidání se odmítne (lib/clearance-hold.ts, 18. 11. 2026).
     * Jako poslední — rezervace se zapíše až po všech ostatních kontrolách.
     */
    const cartId =
      (hookInput as { cart?: { id?: string } }).cart?.id ??
      (input as { cart_id?: string }).cart_id
    if (cartId) {
      await claimClearanceHolds(
        container,
        cartId,
        input.items.map((item) => item.variant_id).filter(Boolean) as string[]
      )
    }
  }
)
