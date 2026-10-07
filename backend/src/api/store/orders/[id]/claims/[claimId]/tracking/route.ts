import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { verifyOrderAccessToken } from "../../../../../../../lib/order-access-link"
import { notifyMerchant } from "../../../../../../../lib/notify"
import { kindLabel } from "../../../../../../../lib/claims/constants"
import { RETURN_REQUEST_MODULE } from "../../../../../../../modules/return-request"
import type ReturnRequestModuleService from "../../../../../../../modules/return-request/service"

/**
 * POST /store/orders/:id/claims/:claimId/tracking — zákazník zapíše číslo
 * zásilky, kterou poslal zboží zpět (docs/reklamace-a-zruseni.md §4).
 *
 * Jen ve stavu `approved`: před schválením nemá co posílat, po přijetí zboží
 * už číslo nic neřekne. Token = důkaz, že jde o zákazníka té objednávky; žádost
 * musí k objednávce patřit (jinak 404, ne 403 — nezrazujeme, že existuje).
 */

const PostSchema = z.object({
  token: z.string().min(1),
  tracking: z.string().trim().min(2).max(120),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = PostSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Zadejte prosím číslo zásilky."
    )
  }
  const orderId = req.params.id
  if (!verifyOrderAccessToken(orderId, parsed.data.token)) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Odkaz je neplatný nebo vypršel. Otevřete prosím ten z posledního e-mailu, nebo se nám ozvěte."
    )
  }

  const service = req.scope.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )
  let request: any
  try {
    request = await service.retrieveReturnRequest(req.params.claimId)
  } catch {
    request = null
  }
  if (!request || request.order_id !== orderId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Žádost nebyla nalezena.")
  }
  if (request.status !== "approved") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      request.status === "received" || request.status === "resolved"
        ? "Zásilka už k nám dorazila — číslo není třeba."
        : "Číslo zásilky jde zapsat až po schválení žádosti."
    )
  }

  const updated = await service.updateReturnRequests({
    id: request.id,
    goods_tracking: parsed.data.tracking,
  })

  // Zvonek pro majitelku: zásilka je na cestě, ať ví, co čekat. Klíč nese
  // číslo, takže oprava čísla zákazníkem zazvoní znovu, opakované uložení ne.
  await notifyMerchant(req.scope, {
    key: `mn:return-tracking:${request.id}:${parsed.data.tracking}`,
    title: `${kindLabel(request.kind)} #${request.order_display_id}: zboží je na cestě zpět`,
    description: `Číslo zásilky od zákazníka: ${parsed.data.tracking}`,
    audience: "owner",
    resource: { id: request.order_id, type: "order" },
  }).catch(() => undefined)

  res.status(200).json({ saved: true, goods_tracking: updated.goods_tracking ?? null })
}
