import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { googleReviewUrl } from "../../../../../lib/google-review-url"
import { claimVerdict } from "../../../../../lib/review-request-rules"
import {
  REVIEW_ORDER_FIELDS,
  reviewRequestKey,
  sendReviewRequest,
} from "../../../../../lib/review-request"
import { RETURN_REQUEST_MODULE } from "../../../../../modules/return-request"
import type ReturnRequestModuleService from "../../../../../modules/return-request/service"

/**
 * POST /admin/merchant-orders/:orderId/review-request — prosba o recenzi
 * TEĎ, mimo job (docs/sledovani-zasilek.md §6).
 *
 * Job ji posílá týden po převzetí; tohle je pro majitelku („chci poprosit
 * dřív") a pro ověření, jak e-mail vypadá. Stejná šablona, stejný dedupe
 * klíč — druhé kliknutí bez `force` nic nepošle. `force: true` = vědomé
 * opakování s vlastním klíčem (zapíše se do historie e-mailů objednávky).
 * Zrušená objednávka a zamítnutá / vrácená reklamace zůstávají zamčené i
 * s `force` — tam prosba o recenzi nemá co dělat.
 */

type Body = { force?: boolean }

export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  const body = (req.body ?? {}) as Body
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: REVIEW_ORDER_FIELDS,
    filters: { id: req.params.orderId },
  })
  const order = (data[0] as any) ?? null
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }
  if (order.status === "canceled") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Zrušené objednávce se o recenzi neprosí."
    )
  }

  const claims = (await req.scope
    .resolve<ReturnRequestModuleService>(RETURN_REQUEST_MODULE)
    .listReturnRequests({ order_id: order.id } as never)) as any[]
  const verdict = claimVerdict(claims)
  if (verdict === "never") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "K objednávce byla zamítnutá nebo vrácená reklamace — o recenzi neprosíme."
    )
  }
  if (verdict === "defer" && !body.force) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "K objednávce běží reklamace — prosbu pošlete až po jejím vyřízení (nebo vědomě s force)."
    )
  }

  const key = body.force
    ? `${reviewRequestKey(order.id)}:manual:${Date.now()}`
    : reviewRequestKey(order.id)
  const sent = await sendReviewRequest(req.scope, order, { key })

  res.status(200).json({
    sent,
    key,
    google_review: Boolean(googleReviewUrl()),
    message: !sent
      ? "Objednávka nemá e-mailovou adresu — není kam poslat."
      : body.force
        ? "Prosba o recenzi odeslána (vědomé opakování)."
        : "Prosba o recenzi odeslána. Pokud už jednou odešla, dedupe ji podruhé nepustí — použijte force.",
  })
}
