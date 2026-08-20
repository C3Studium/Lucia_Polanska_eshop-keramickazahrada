import {
  createStep,
  StepResponse,
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
type CartMetadataInput = { cartId: string }


const getCartMetadataStep = createStep(
  "get-cart-metadata",
  async ({ cartId }: CartMetadataInput, { container }) => {
    try {
      const cartService = container.resolve("cart")
      // Získání cartu včetně metadata a shipping_address
      const cart = await cartService.retrieveCart(cartId, {
        relations: ["metadata", "shipping_address"],
      })

      const pickupPoint = cart.metadata?.packeta_pickup_point
      const shippingAddress = cart.shipping_address
      const email = cart.email

      if (!shippingAddress) {
        throw new Error("Shipping address not found on cart.")
      }

      // Sloučení existujících metadat adresy s pickup pointem
      const updatedMetadata = {
        ...(shippingAddress.metadata || {}),
        packeta_pickup_point: pickupPoint,
        email: email
      }

      // Aktualizace metadat adresy
      await cartService.updateAddresses([
        {
          id: shippingAddress.id,
          metadata: updatedMetadata,
        }
      ])

      return new StepResponse(updatedMetadata)
    } catch (error: any) {
      console.warn("packeta-workflow: metadata write failed", error)
      throw error
    }
  }
)

// Tohle je to správné volání createWorkflow s 3 parametry
const CartMetadataWorkflow = createWorkflow(
  "product-count",
  (input:CartMetadataInput) => {
    const metadata = getCartMetadataStep(input)

    return new WorkflowResponse({
      metadata,
    }) as unknown as WorkflowResponse<{ metadata: unknown }>
  },
)

export default CartMetadataWorkflow