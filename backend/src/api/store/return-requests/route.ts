import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  CLAIM_ORDER_FIELDS,
  listOrderClaims,
} from "../../../lib/claims/context"
import { checkClaimRules, createClaim } from "../../../lib/claims/intake"
import { PostStoreCreateReturnRequest } from "./validators"

/**
 * POST /store/return-requests — the returns conversation's back door.
 *
 * Záložní cesta (číslo objednávky + e-mail jako důkaz vlastnictví) pro
 * zákazníka bez e-mailového odkazu. Storefront používá tokenovou
 * `POST /store/orders/:id/claims`; obě routy sdílí JEDEN intake
 * (`lib/claims/intake`), takže fotky, protokol, lhůty i e-maily jsou totožné.
 *
 * ## Why every outcome answers the same way
 *
 * The route is unauthenticated (order number + e-mail is the proof of
 * ownership), so a different answer for „order not found", „e-mail does not
 * match" and „created" would be an oracle for probing which order numbers
 * exist and whose they are. Everything returns `GENERIC_RESPONSE`; the honest
 * signal for a genuine customer is the confirmation e-mail. Platí to i pro
 * serverová pravidla (§1837, lhůta, otevřená žádost): porušení tady znamená
 * „nic nezaložit a odpovědět stejně", ne 400 — jinak by chybová hláška
 * potvrdila, že číslo a e-mail k sobě patří. Kdo chce vysvětlení, má tokenovou
 * stránku ve storefrontu.
 */

const GENERIC_RESPONSE = { received: true }

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = PostStoreCreateReturnRequest.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Vyplňte prosím číslo objednávky, e-mail a důvod vrácení."
    )
  }
  const body = parsed.data

  // „#1234" from the confirmation e-mail and a plain „1234" are the same order.
  const displayId = Number(body.order_display_id.replace(/^#/, "").trim())
  if (!Number.isInteger(displayId) || displayId <= 0) {
    return res.status(200).json(GENERIC_RESPONSE)
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: CLAIM_ORDER_FIELDS,
    filters: { display_id: displayId },
  })
  const order = orders[0] as any

  if (
    !order?.email ||
    order.email.trim().toLowerCase() !== body.email.toLowerCase()
  ) {
    return res.status(200).json(GENERIC_RESPONSE)
  }

  const existing = await listOrderClaims(req.scope, order.id)
  const input = {
    kind: body.kind ?? null,
    reason: body.reason,
    requested_resolution: body.requested_resolution ?? null,
    items: body.items ?? null,
    photos: body.photos ?? null,
  }

  // One open request per order, §1837, 14 dnů, požadované vyřízení — viz
  // hlavička: porušení = stejná odpověď, nic se nezaloží.
  const verdict = checkClaimRules(order, existing, input)
  if (!verdict.ok) {
    return res.status(200).json(GENERIC_RESPONSE)
  }

  await createClaim(req.scope, { order, input, existingRequests: existing })

  return res.status(200).json(GENERIC_RESPONSE)
}
