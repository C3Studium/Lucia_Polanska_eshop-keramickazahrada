import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { addToCartWorkflow, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { getCustomPriceWorkflow } from "./get-custom-price"
import { VOUCHER_LINE_KEYS } from "../lib/gift-voucher-orders"

type CustomAddToCartWorkflowInput = {
  item: {
    variant_id: string;
    quantity?: number;
    metadata?: Record<string, unknown>;
  }
  cart_id: string;
}

export const customAddToCartWorkflow = createWorkflow(
  "custom-add-to-cart",
  (input: CustomAddToCartWorkflowInput) => {
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: ["region_id"],
      filters: {
        id: input.cart_id,
      },
      options: {
        throwIfKeyNotFound: true,
      },
    }).config({ name: "get-cart-region" })
    const price = getCustomPriceWorkflow.runAsStep({
      input: {
        variant_id: input.item.variant_id,
        region_id: carts[0].region_id!,
        metadata: input.item.metadata,
      },
    })

    /* Je to zakázka? Rozhoduje produkt varianty, ne značka na řádku. */
    const { data: variants } = useQueryGraphStep({
      entity: "variant",
      fields: ["id", "product.metadata"],
      filters: { id: input.item.variant_id },
    }).config({ name: "get-variant-product" })

    const itemData = transform({
      item: input.item,
      price,
      variants,
    }, (data) => {
      /*
       * Elektronický dárkový poukaz chodí e-mailem — položka nepotřebuje
       * dopravu. Medusa pak košík bez jiného zboží dokončí bez zvolené dopravy
       * (validateShippingStep hlídá jen položky s requires_shipping) a pokladna
       * krok Doručení přeskočí. Vytištěný poukaz se posílá poštou jako zboží.
       */
      const electronicVoucher =
        data.item.metadata?.[VOUCHER_LINE_KEYS.kind] === "electronic"
      const quantity = Math.max(1, Math.floor(Number(data.item.quantity) || 1))
      const base = {
        variant_id: data.item.variant_id,
        metadata: data.item.metadata,
        unit_price: data.price,
        ...(electronicVoucher ? { requires_shipping: false } : {}),
      }

      /*
       * Zakázka = JEDEN KUS NA ŘÁDEK (31. 10. 2026).
       *
       * Každý kus výroby na míru má vlastní zadání, vlastní domluvenou cenu
       * i vlastní zálohu — a zakázka v modulu vzniká jedna na řádek
       * objednávky. Dva kusy na jednom řádku tedy znamenaly jednu cenu pro
       * oba a jedno zadání, ze kterého se pak v administraci nedalo poznat,
       * co patří ke kterému kusu.
       *
       * „2 kusy" se proto rozpadnou na dva samostatné řádky. Aby je Medusa
       * při přidání nesloučila zpátky (slučuje podle varianty a metadat),
       * nese každý vlastní `piece_key` — jen rozlišovací značka, nic ji
       * nečte. Běžné zboží se nedělí: tam je množství prostě množství.
       */
      const madeToOrder = Boolean(
        (data.variants?.[0] as any)?.product?.metadata?.made_to_order
      )
      if (!madeToOrder || quantity === 1) {
        return [{ ...base, quantity }]
      }
      const razitko = `${Date.now().toString(36)}`
      return Array.from({ length: quantity }, (_, index) => ({
        ...base,
        quantity: 1,
        metadata: {
          ...(data.item.metadata ?? {}),
          made_to_order: {
            ...((data.item.metadata?.made_to_order as Record<string, unknown>) ?? {}),
            piece_key: `${razitko}-${index}`,
          },
        },
      }))
    })

    addToCartWorkflow.runAsStep({
      input: {
        cart_id: input.cart_id,
        items: itemData,
      },
    })

    // refetch the updated cart
    const { data: updatedCart } = useQueryGraphStep({
      entity: "cart",
      fields: ["*", "items.*"],
      filters: {
        id: input.cart_id,
      },
    }).config({ name: "refetch-cart" })

    return new WorkflowResponse({
      cart: updatedCart[0],
    })
  }
)