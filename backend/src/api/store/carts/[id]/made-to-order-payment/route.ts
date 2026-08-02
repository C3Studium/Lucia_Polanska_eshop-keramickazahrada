import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { prepareMadeToOrderPaymentWorkflow } from "../../../../../workflows/prepare-made-to-order-payment"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { result } = await prepareMadeToOrderPaymentWorkflow(req.scope).run({
    input: { cart_id: req.params.id },
  })

  res.status(200).json({ payment: result })
}

