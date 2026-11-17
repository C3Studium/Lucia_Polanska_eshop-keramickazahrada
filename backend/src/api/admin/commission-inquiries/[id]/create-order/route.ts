import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  CreateInquiryOrderSchema,
  inquiryOrderIssueMessage,
} from "../../../../../lib/commission-inquiry-order"
import { createOrderFromInquiry } from "../../../../../lib/commission-inquiry-order-create"

/**
 * POST /admin/commission-inquiries/:id/create-order — z poptávky zakázky
 * založí objednávku (17. 11. 2026). Tělo podle `CreateInquiryOrderSchema`
 * (název, zadání, cena, záloha, doprava…). Odpověď
 * `{ order_id, display_id, emailed_price, warning }`.
 *
 * Druhá objednávka k téže poptávce se odmítne (409).
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const parsed = CreateInquiryOrderSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, inquiryOrderIssueMessage(parsed.error))
  }
  const result = await createOrderFromInquiry(req.scope, req.params.id, parsed.data)
  res.status(201).json(result)
}
