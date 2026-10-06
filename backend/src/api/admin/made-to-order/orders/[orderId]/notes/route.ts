import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MADE_TO_ORDER_MODULE } from "../../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../../modules/made-to-order/service"
import {
  customerName,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../../../../../../lib/customer-email"

/**
 * Deník výroby — the diary of one zakázka (feature-ideas 2.1/2.2).
 *
 * GET lists newest-first; POST adds an entry. An entry is a photo, a note,
 * or both — but never neither, because an empty diary line is a
 * mis-tap, and storing it would put a blank row in front of her forever.
 *
 * The body is parsed here rather than via middleware registration —
 * `req.body` directly, the same pattern as the actions route next door, so
 * this route cannot repeat the restock mistake (reading `validatedBody`
 * nobody populated).
 */

const PostNoteSchema = z
  .object({
    text: z.string().max(2000).optional(),
    image_url: z.string().url().optional(),
    visible_to_customer: z.boolean().optional(),
  })
  .refine((body) => (body.text ?? "").trim() || body.image_url, {
    message: "Zápis potřebuje text nebo fotku.",
  })

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const notes = (await service.listProductionNotes(
    { order_id: req.params.orderId } as never,
    { order: { created_at: "DESC" }, take: 200 } as never
  )) as any[]

  res.status(200).json({
    notes: notes.map((note) => ({
      id: note.id,
      text: note.text,
      image_url: note.image_url,
      // Jeden řádek = jedna zpráva se svými fotkami (`images`). Staré řádky
      // (jedna fotka na řádek) spadnou na `image_url`.
      images: Array.isArray(note.images)
        ? note.images
        : note.image_url
          ? [note.image_url]
          : [],
      visible_to_customer: Boolean(note.visible_to_customer),
      // Kdo zápis napsal — ať „Konverzace se zákazníkem" čte jako chat a
      // majitelka pozná novou zprávu zákazníka od vlastní poznámky. Zákazník
      // píše přes store route s `created_by: "customer"`; všechno ostatní
      // (text i foto z dílny) je ateliér.
      author: note.created_by === "customer" ? "customer" : "atelier",
      created_at: note.created_at,
    })),
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = PostNoteSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues[0]?.message ?? "Neplatný zápis."
    )
  }

  const service = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  // The diary belongs to a zakázka; a typo'd order id should say so rather
  // than create an orphan diary nobody can ever open.
  const [production] = (await service.listProductionOrders({
    order_id: req.params.orderId,
  } as never)) as any[]
  if (!production) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "K této objednávce žádná zakázka neexistuje."
    )
  }

  const created = (await service.createProductionNotes({
    order_id: req.params.orderId,
    text: (parsed.data.text ?? "").trim() || null,
    // Dílna přikládá jednu fotku na zápis; i tak píšeme do `images`, ať je
    // tvar zprávy jednotný s tím, co posílá zákazník. `image_url` necháváme
    // kvůli zpětné čitelnosti (e-mail „nová zpráva k zakázce").
    images: parsed.data.image_url ? [parsed.data.image_url] : null,
    image_url: parsed.data.image_url ?? null,
    visible_to_customer: parsed.data.visible_to_customer ?? false,
    created_by: req.auth_context?.actor_id ?? null,
  } as never)) as any
  const note = Array.isArray(created) ? created[0] : created

  /*
   * Druhá polovina chatu: zápis VIDITELNÝ zákazníkovi = zpráva pro něj →
   * e-mail „nová zpráva k vaší zakázce" (interní poznámky se neposílají).
   * Keyed podle id zápisu, aby každá zpráva dorazila jednou. Chyba e-mailu
   * nesmí shodit uložení zápisu.
   */
  if (parsed.data.visible_to_customer) {
    try {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data: orders } = await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "email",
          "customer.first_name",
          "customer.last_name",
          "shipping_address.first_name",
          "shipping_address.last_name",
        ],
        filters: { id: req.params.orderId },
      })
      const order = orders[0] as any
      if (order?.email) {
        await sendCustomerEmail(req.scope, {
          template: "commission-message",
          to: order.email,
          key: `commission-msg:${note?.id ?? req.params.orderId}`,
          orderId: order.id,
          data: {
            customerName: customerName(order),
            orderNumber: orderNumber(order),
            orderLink: orderLink(order),
            message: (parsed.data.text ?? "").trim() || "",
            photoUrl: parsed.data.image_url ?? "",
          },
        }).catch(() => undefined)
      }
    } catch {
      // E-mail je doplněk — bez něj zápis platí dál.
    }
  }

  res.status(201).json({ note })
}
