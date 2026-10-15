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
import { CLAIM_CHANNEL_ONLINE } from "../../../../../lib/claims/constants"

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
 * žádost, popis a požadované vyřízení u reklamace, položky u reklamace
 * i vrácení, fotky u poškození přepravou i poškozeného kusu) platí na
 * serveru beze změny —
 * gating v prohlížeči je jen zrcadlo téhle odpovědi. Odstoupení / vrácení
 * nezaplacené a neodeslané objednávky se vyřídí hned (§13.1) — odpověď nese
 * `auto_cancelled: true`.
 *
 * Odstoupení online (§ 1830a OZ, 14. 10. 2026): stránka `/order/:id/odstoupeni`
 * pošle po kontrole (krok 2, „Potvrdit odstoupení od smlouvy") `kind:
 * "odstoupeni"` s vybraným zbožím (`items`; zakázku server vyjme sám),
 * nepovinným důvodem a případně účtem. Odpověď nese `submitted_at` (čas
 * serveru) a `confirmation` — přesně to, co odešlo v potvrzovacím e-mailu,
 * ať ho stránka ukáže hned na obrazovce i s datem a časem odeslání.
 */

const PostSchema = z.object({
  token: z.string().min(1),
  kind: z.enum(["reklamace", "vraceni", "odstoupeni"]),
  /**
   * Popis vady — povinný jen u reklamace (hlídá `checkClaimRules`).
   * Odstoupení a vrácení ho nemají (12. 10. 2026, Matěj); uloží se výchozí
   * věta podle druhu (`claimReasonFor`).
   */
  reason: z.string().trim().max(2000).optional(),
  /**
   * `repair` schéma ještě pustí, ale `checkClaimRules` ho u nové reklamace
   * odmítne s českou hláškou (12. 10. 2026, Matěj: jen výměna / vrácení
   * peněz) — obecná hláška o neplatném těle by zákazníkovi neřekla proč.
   */
  requested_resolution: z.enum(["repair", "replace", "refund"]).optional(),
  /**
   * Vybrané položky `{ id, quantity }` (§11.1): u reklamace i vrácení povinné
   * (aspoň jedna); u odstoupení zboží, od jehož koupě se odstupuje (prázdné =
   * vše, od čeho odstoupit lze; zakázka se vyjme na serveru). Příslušnost
   * k objednávce a strop množství hlídá `checkClaimRules`.
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
  /**
   * `"carrier"` = balík dorazil poškozený (§11.3), `"damaged"` = poškozený kus
   * (§13.7) → u obou fotky povinné (`checkClaimRules`).
   */
  damage_cause: z.enum(["carrier", "damaged"]).nullable().optional(),
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
  /**
   * Účet pro vrácení převodem (dobírka, osobní odběr) — storefront ho posílá,
   * když kontext řekne `refund_account_needed`; formát a povinnost hlídá
   * `checkClaimRules`. Chybějící pole (starší storefront) se nehlídá.
   */
  refund_account: z.string().max(80).nullable().optional(),
  /**
   * Jméno z formuláře odstoupení (předvyplněné z objednávky, lze opravit).
   * Prázdné / chybějící = jméno z objednávky.
   */
  customer_name: z.string().trim().max(200).optional(),
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
      "Vyplňte prosím druh žádosti. U reklamace i popis vady a to, co požadujete."
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
    reason: body.reason ?? "",
    requested_resolution: body.requested_resolution ?? null,
    // Vždy pole: tahle routa výběr položek MÁ, takže u reklamace platí
    // „aspoň jedna" (null by znamenalo volajícího bez výběru — záložní routa).
    line_items: body.items ?? [],
    damage_cause: body.damage_cause ?? null,
    photos: body.photos ?? null,
    refund_account: body.refund_account,
    customer_name: body.customer_name ?? null,
  }
  const verdict = checkClaimRules(order, existing, input)
  if (verdict.ok === false) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, verdict.message)
  }

  const { request, autoCancelled, submittedAt, confirmation } = await createClaim(
    req.scope,
    {
      order,
      input,
      existingRequests: existing,
      channel: CLAIM_CHANNEL_ONLINE,
    }
  )

  // §13.1: `auto_cancelled` → storefront místo „posoudíme" ukáže „Objednávka
  // je zrušená". `confirmation` = obsah potvrzení s datem a časem odeslání.
  res.status(200).json({
    received: true,
    id: request.id,
    submitted_at: submittedAt.toISOString(),
    confirmation,
    ...(autoCancelled ? { auto_cancelled: true } : {}),
  })
}
