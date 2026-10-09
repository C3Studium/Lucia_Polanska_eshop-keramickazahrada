import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { verifyOrderAccessToken } from "../../../../../lib/order-access-link"
import {
  buildClaimsContext,
  listOrderClaims,
  loadClaimOrder,
} from "../../../../../lib/claims/context"
import {
  checkClaimRules,
  createClaim,
  MAX_PHOTOS,
} from "../../../../../lib/claims/intake"

/**
 * Reklamace / vrácení / odstoupení z e-mailového odkazu — BEZ přihlášení,
 * autorizace podepsaným tokenem (docs/reklamace-a-zruseni.md §4, §11.1).
 *
 * GET vrací kontext pro storefront: smí zákazník odstoupit (`can_withdraw`),
 * dokdy, proč ne, adresu pro vrácení z nastavení, položky objednávky k výběru
 * (`order_items`) a stav všech žádostí k objednávce (každá s `line_items` a
 * `damage_cause`). POST zakládá žádost přes SDÍLENÝ intake
 * (`lib/claims/intake`), stejný jako záložní `/store/return-requests`.
 *
 * Token odemyká JEN přihlášení. Pravidla (§1837, 14 dnů, jedna otevřená
 * žádost, požadované vyřízení u reklamace, položky u reklamace, fotky u
 * poškození přepravou) platí na serveru beze změny — gating v prohlížeči je
 * jen zrcadlo téhle odpovědi.
 */

const PostSchema = z.object({
  token: z.string().min(1),
  kind: z.enum(["reklamace", "vraceni", "odstoupeni"]),
  reason: z.string().trim().min(1).max(2000),
  requested_resolution: z.enum(["repair", "replace", "refund"]).optional(),
  /**
   * Vybrané položky `{ id, quantity }` (§11.1): u reklamace povinné (aspoň
   * jedna), u vrácení volitelné (bez položek = vše), u odstoupení se ignorují.
   * Příslušnost k objednávce a strop množství hlídá `checkClaimRules`.
   */
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        quantity: z.coerce.number().int().min(1).max(10_000),
      })
    )
    .max(200)
    .optional(),
  /** `"carrier"` = balík dorazil poškozený (§11.3) → fotky povinné. */
  damage_cause: z.enum(["carrier"]).nullable().optional(),
  photos: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        mime_type: z.string().min(1),
        data: z.string().min(1),
      })
    )
    .max(MAX_PHOTOS)
    .optional(),
})

const requireToken = (orderId: string, token: unknown) => {
  if (!verifyOrderAccessToken(orderId, token)) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Odkaz je neplatný nebo vypršel. Otevřete prosím ten z posledního e-mailu, nebo se nám ozvěte."
    )
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id
  requireToken(orderId, req.query.token)

  const order = await loadClaimOrder(req.scope, orderId)
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }

  res.status(200).json(await buildClaimsContext(req.scope, order))
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = PostSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Vyplňte prosím druh žádosti a popis. U reklamace i to, co požadujete."
    )
  }
  const body = parsed.data
  const orderId = req.params.id
  requireToken(orderId, body.token)

  const order = await loadClaimOrder(req.scope, orderId)
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }

  const existing = await listOrderClaims(req.scope, order.id)
  const input = {
    kind: body.kind,
    reason: body.reason,
    requested_resolution: body.requested_resolution ?? null,
    // Vždy pole: tahle routa výběr položek MÁ, takže u reklamace platí
    // „aspoň jedna" (null by znamenalo volajícího bez výběru — záložní routa).
    line_items: body.items ?? [],
    damage_cause: body.damage_cause ?? null,
    photos: body.photos ?? null,
  }
  const verdict = checkClaimRules(order, existing, input)
  if (verdict.ok === false) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, verdict.message)
  }

  const { request } = await createClaim(req.scope, {
    order,
    input,
    existingRequests: existing,
  })

  res.status(200).json({ received: true, id: request.id })
}
