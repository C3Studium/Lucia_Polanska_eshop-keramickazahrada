import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import {
  VOUCHER_DEFAULTS,
  isCustomAmountVoucher,
  voucherConfig,
} from "../../../../lib/voucher"

/**
 * Meze poukazu s vlastní částkou — „od kolika do kolika".
 *
 * Hodnoty bydlí v metadatech toho produktu (`voucher_min`, `voucher_max`,
 * `voucher_step`), protože odtud je čte obchod i pokladna. Do té doby se
 * daly změnit jedině skriptem (`scripts/legal-voucher-product.ts`), takže
 * majitelka musela napsat vývojáři, aby zvedla strop — teď je to políčko
 * na stránce Poukazy (31. 10. 2026).
 *
 * Produkt se hledá podle vlajky `voucher_custom_amount`, ne podle názvu nebo
 * id: tak ho poznává i zbytek obchodu, takže se nemůže stát, že nastavíme
 * meze jinému produktu, než podle kterého se pak počítá.
 */
export const PostVoucherLimitsSchema = z
  .object({
    min: z.number().int().min(1).max(1_000_000),
    max: z.number().int().min(1).max(1_000_000),
    step: z.number().int().min(1).max(100_000),
  })
  .refine((value) => value.max >= value.min, {
    message: "Horní mez nemůže být nižší než dolní.",
    path: ["max"],
  })
  .refine((value) => value.step <= value.max - value.min || value.min === value.max, {
    message: "Krok je větší než celý rozsah — zákazník by neměl z čeho vybírat.",
    path: ["step"],
  })

const findVoucherProduct = async (req: AuthenticatedMedusaRequest) => {
  const productModule = req.scope.resolve(Modules.PRODUCT)
  const products = (await productModule.listProducts(
    {} as never,
    { take: 1000, select: ["id", "title", "metadata"] as never }
  )) as any[]
  return products.find((product) => isCustomAmountVoucher(product?.metadata)) ?? null
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const product = await findVoucherProduct(req)
  if (!product) {
    res.status(200).json({ product: null, limits: { ...VOUCHER_DEFAULTS } })
    return
  }
  res.status(200).json({
    product: { id: product.id, title: product.title },
    limits: voucherConfig(product.metadata),
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<z.infer<typeof PostVoucherLimitsSchema>>,
  res: MedusaResponse
) => {
  const product = await findVoucherProduct(req)
  if (!product) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "V katalogu není žádný poukaz s vlastní částkou — meze není kam uložit."
    )
  }

  const { min, max, step } = req.validatedBody
  const productModule = req.scope.resolve(Modules.PRODUCT)
  /* Metadata se slučují po klíčích, takže ostatní vlajky produktu zůstávají. */
  await productModule.updateProducts(product.id, {
    metadata: { voucher_min: min, voucher_max: max, voucher_step: step },
  } as never)

  const [updated] = (await productModule.listProducts(
    { id: product.id } as never,
    { take: 1, select: ["id", "title", "metadata"] as never }
  )) as any[]

  res.status(200).json({
    product: { id: product.id, title: product.title },
    limits: voucherConfig(updated?.metadata),
  })
}
