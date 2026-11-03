import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { getLoyaltySettings, issueManualLoyaltyCode } from "../../../../../../lib/loyalty-code"
import { LOYALTY_LIMITS } from "../../../../../../lib/loyalty-code-rules"

/**
 * „Poslat slevový kód" z karty zákazníka — vytvoří jednorázový kód jen pro
 * tohoto člověka a rovnou mu ho pošle e-mailem, nebo neudělá nic
 * (`lib/loyalty-code.ts`). Bez zadání platí výchozí sleva a platnost
 * z nastavení „Kód pro stálé zákazníky".
 */
export const LoyaltyCodeBodySchema = z.object({
  percentage: z
    .number()
    .int()
    .min(LOYALTY_LIMITS.percentage.min)
    .max(LOYALTY_LIMITS.percentage.max)
    .optional(),
  valid_days: z
    .number()
    .int()
    .min(LOYALTY_LIMITS.valid_days.min)
    .max(LOYALTY_LIMITS.valid_days.max)
    .optional(),
})

export const parseLoyaltyCodeBody = (body: unknown) => {
  const parsed = LoyaltyCodeBodySchema.safeParse(body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Sleva musí být ${LOYALTY_LIMITS.percentage.min}–${LOYALTY_LIMITS.percentage.max} % a platnost ${LOYALTY_LIMITS.valid_days.min}–${LOYALTY_LIMITS.valid_days.max} dní (celá čísla).`
    )
  }
  return parsed.data
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = parseLoyaltyCodeBody(req.body)
  const defaults = await getLoyaltySettings(req.scope)
  const { code, sentTo } = await issueManualLoyaltyCode(req.scope, {
    customerId: req.params.customerId,
    percentage: body.percentage ?? defaults.percentage,
    validDays: body.valid_days ?? defaults.valid_days,
  })
  res.status(201).json({
    code: code.code,
    percentage: code.percentage,
    expires_at: code.endsAt.toISOString(),
    sent_to: sentTo,
  })
}
