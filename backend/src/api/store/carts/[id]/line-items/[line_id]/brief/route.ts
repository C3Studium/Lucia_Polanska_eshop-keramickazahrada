import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { z } from "zod"
import { mergeCommissionBrief } from "../../../../../../../lib/commission-brief"

/**
 * Zadání zakázky („co si představujete") na řádek košíku.
 *
 * ## Proč vlastní cesta, a ne nativní úprava položky
 *
 * ZMĚŘENO 30. 10. 2026: nativní `POST /store/carts/:id/line-items/:line_id`
 * projde `updateLineItemInCartWorkflow`, a ten na konci volá
 * `validateVariantPricesStep` — varianta BEZ ceny v ceníku shodí celé
 * uložení hláškou „Variants with IDs … do not have a price". Přesně to je
 * výrobek s cenou po domluvě (`lib/price-on-request.ts`): cenu nemá schválně,
 * do košíku jde za 0 Kč. Zákazník tedy napsal zadání, přiložil fotky a dostal
 * „Něco se nepovedlo" — a bez zadání ho brána nepustila k objednávce. Zakázka
 * s cenou po domluvě tak nešla objednat vůbec.
 *
 * Brief jsou metadata. S penězi nemá co do činění, takže se zapisuje přímo
 * modulem košíku: žádné přepočítávání cen, žádná varianta, žádné `quantity`
 * navíc (nativní cesta ho vyžadovala a storefront ho kvůli tomu musel načítat
 * a posílat zpátky, aby ho omylem nezměnil).
 *
 * ## Zadání po kusech
 *
 * Řádek s množstvím 2 je pořád jeden řádek, ale jsou to DVA kusy a každý se
 * může lišit (jiné jméno na domovním znamení, jiná fotka). Zadání proto bydlí
 * v poli `made_to_order.pieces` a `piece` říká, kterého kusu se uložení týká.
 * `specification` a `photos` na řádku zůstávají složeným pohledem přes
 * všechny kusy — čte je administrace, PDF Potvrzení zakázky i e-maily
 * a nemusí o kusech vědět. Množství 1 pole nezakládá a chová se jako dřív.
 */
export const PostCommissionBriefSchema = z.object({
  note: z.string().max(4000).optional(),
  photos: z.array(z.string().url()).max(12).optional(),
  /** Pořadí kusu v rámci řádku (0-based). Bez něj = celý řádek / první kus. */
  piece: z.number().int().min(0).max(99).optional(),
  /**
   * Čas zaškrtnutí poučení Z10 k této položce. Posílá ho pokladna při
   * souhlasu — sám, BEZ `note`, aby zaškrtnutí nepřepsalo zadání kusů.
   */
  ack_at: z.string().datetime().optional(),
})

export const POST = async (
  req: MedusaRequest<z.infer<typeof PostCommissionBriefSchema>>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const cartId = req.params.id
  const lineId = req.params.line_id

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "items.id", "items.quantity", "items.metadata"],
    filters: { id: cartId },
  })
  const cart = carts[0] as any
  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Košík nebyl nalezen.")
  }

  const line = ((cart.items ?? []) as any[]).find((item) => item?.id === lineId)
  if (!line) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Položka v košíku nebyla nalezena."
    )
  }

  const metadata = mergeCommissionBrief({
    current: line.metadata,
    quantity: Number(line.quantity ?? 1),
    piece: req.validatedBody.piece,
    // Vynechané zadání = mění se jen poučení; kusy zůstávají.
    note: req.validatedBody.note,
    photos: req.validatedBody.photos,
    ackAt: req.validatedBody.ack_at,
  })

  /*
   * Přímo modulem košíku. `updateLineItemInCartWorkflow` by znovu ověřoval
   * cenu varianty (viz hlavička) a brief žádnou cenu nemění.
   */
  const cartModule = req.scope.resolve(Modules.CART)
  await cartModule.updateLineItems([{ selector: { id: lineId }, data: { metadata } }])

  res.status(200).json({ ok: true, made_to_order: metadata.made_to_order })
}
