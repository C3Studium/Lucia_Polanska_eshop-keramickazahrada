import { ProductVariantDTO } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  isCustomAmountVoucher,
  validateVoucherAmount,
  VOUCHER_AMOUNT_KEY,
  voucherConfig,
} from "../../lib/voucher"

export type GetCustomPriceStepInput = {
  variant: ProductVariantDTO & {
    calculated_price?: {
      calculated_amount: number
      currency_code?: string | null
    }
  }
  metadata?: Record<string, unknown>
}

const DIMENSION_PRICE_FACTOR = 0.01

export const getCustomPriceStep = createStep(
  "get-custom-price",
  async ({
    variant, metadata = {},
  }: GetCustomPriceStepInput) => {
    /*
     * Dárkový poukaz s vlastní částkou: cenou řádku je částka, kterou zákazník
     * zvolil (`metadata.voucher_amount`), ověřená proti mezím z produktu
     * (`lib/voucher.ts`). Měna košíku přichází v `calculated_price` — workflow
     * ji počítá v kontextu měny regionu. Bez ceny v té měně (varianta ji
     * nemá) měnu neznáme → „unknown" poukaz odmítne, místo aby částku
     * v korunách tiše prodal v eurech.
     */
    if (isCustomAmountVoucher(variant.product?.metadata as Record<string, unknown>)) {
      const result = validateVoucherAmount(
        metadata[VOUCHER_AMOUNT_KEY],
        voucherConfig(variant.product?.metadata as Record<string, unknown>),
        variant.calculated_price?.currency_code || "unknown"
      )
      if ("message" in result) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, result.message)
      }
      return new StepResponse(result.amount)
    }

    if (!variant.product?.metadata?.is_personalized) {
      return new StepResponse(variant.calculated_price?.calculated_amount || 0)
    }
    if (!metadata.height || !metadata.width) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Custom price requires width and height metadata to be set."
      )
    }
    const height = metadata.height as number
    const width = metadata.width as number

    const originalPrice = variant.calculated_price?.calculated_amount || 0
    const customPrice = originalPrice + (height * width * DIMENSION_PRICE_FACTOR)

    return new StepResponse(customPrice)
  }
)