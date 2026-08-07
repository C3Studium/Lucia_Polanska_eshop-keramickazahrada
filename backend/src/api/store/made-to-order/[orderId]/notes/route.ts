import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"

/**
 * The customer's half of a zakázka's diary.
 *
 * The owner already had hers — `admin/made-to-order/orders/:id/notes`, the
 * Deník výroby. This is the same table read from the other end, and the two
 * halves are told apart by `created_by`:
 *
 * - `"customer"` — written here. Always visible to both, because there is no
 *   sense in a customer writing something they cannot then see.
 * - anything else — written by her in the admin, and shown to the customer
 *   only when she ticked `visible_to_customer` on that entry. Her glaze
 *   recipes stay hers; the pretty photo travels.
 *
 * A commission is a conversation, and this is where the customer speaks: what
 * they want, and pictures of it. They can keep adding after ordering, because
 * the thing they meant often only becomes sayable once they see it starting.
 */

const CUSTOMER_AUTHOR = "customer"

const PostNoteSchema = z
  .object({
    text: z.string().max(2000).optional(),
    image_urls: z.array(z.string().url()).max(6).optional(),
  })
  .refine(
    (body) => (body.text ?? "").trim() || (body.image_urls ?? []).length,
    { message: "Napište prosím poznámku, nebo přiložte fotku." }
  )

const requireZakazka = async (
  req: MedusaRequest,
  orderId: string
): Promise<MadeToOrderModuleService> => {
  const service = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const [productionOrder] = (await service.listProductionOrders({
    order_id: orderId,
  } as never)) as any[]

  if (!productionOrder) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "K této objednávce není vedena zakázka."
    )
  }

  return service
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = await requireZakazka(req, req.params.orderId)

  const notes = (await service.listProductionNotes(
    { order_id: req.params.orderId } as never,
    { order: { created_at: "DESC" }, take: 200 } as never
  )) as any[]

  res.status(200).json({
    notes: notes
      // Hers is a working notebook; only what she opened up travels.
      .filter(
        (note) =>
          note.created_by === CUSTOMER_AUTHOR || note.visible_to_customer
      )
      .map((note) => ({
        id: note.id,
        text: note.text,
        image_url: note.image_url,
        author: note.created_by === CUSTOMER_AUTHOR ? "customer" : "atelier",
        created_at: note.created_at,
      })),
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = PostNoteSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues[0]?.message ?? "Poznámku se nepodařilo uložit."
    )
  }

  const service = await requireZakazka(req, req.params.orderId)
  const { text, image_urls = [] } = parsed.data
  const trimmed = (text ?? "").trim()

  /*
   * One row per photo, and the text rides on the first of them. The diary is a
   * flat list of entries by design — the admin renders it as one — so a note
   * with three photos as one row would need the admin to learn a second shape.
   */
  const rows =
    image_urls.length > 0
      ? image_urls.map((url, index) => ({
          order_id: req.params.orderId,
          text: index === 0 && trimmed ? trimmed : null,
          image_url: url,
          visible_to_customer: true,
          created_by: CUSTOMER_AUTHOR,
        }))
      : [
          {
            order_id: req.params.orderId,
            text: trimmed,
            image_url: null,
            visible_to_customer: true,
            created_by: CUSTOMER_AUTHOR,
          },
        ]

  await service.createProductionNotes(rows as never)

  const notes = (await service.listProductionNotes(
    { order_id: req.params.orderId } as never,
    { order: { created_at: "DESC" }, take: 200 } as never
  )) as any[]

  res.status(201).json({
    notes: notes
      .filter(
        (note) =>
          note.created_by === CUSTOMER_AUTHOR || note.visible_to_customer
      )
      .map((note) => ({
        id: note.id,
        text: note.text,
        image_url: note.image_url,
        author: note.created_by === CUSTOMER_AUTHOR ? "customer" : "atelier",
        created_at: note.created_at,
      })),
  })
}
