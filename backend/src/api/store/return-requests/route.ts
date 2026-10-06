import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  customerName,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../../../lib/customer-email"
import { notifyMerchant } from "../../../lib/notify"
import {
  buildAndStoreProtocol,
  protocolNumberFor,
} from "../../../lib/reklamacni-protokol"
import { RETURN_REQUEST_MODULE } from "../../../modules/return-request"
import type ReturnRequestModuleService from "../../../modules/return-request/service"
import { PostStoreCreateReturnRequest } from "./validators"

/**
 * POST /store/return-requests — the returns conversation's front door.
 *
 * Today a return is agreed over e-mail; this endpoint receives the same
 * request in a structured form, confirms receipt to the customer
 * („refund-request") and rings the owner's bell. Approval/rejection happens on
 * the admin „Vrácení" page.
 *
 * ## Why every outcome answers the same way
 *
 * The route is unauthenticated (order number + e-mail is the proof of
 * ownership), so a different answer for „order not found", „e-mail does not
 * match" and „created" would be an oracle for probing which order numbers
 * exist and whose they are. Everything returns `GENERIC_RESPONSE`; the honest
 * signal for a genuine customer is the confirmation e-mail.
 */

const GENERIC_RESPONSE = { received: true }

/**
 * Zákonná lhůta na vyřízení podle druhu: reklamace do 30 dnů (§19 ZOS),
 * odstoupení a vrácení = vrátit peníze do 14 dnů (§1832). Počítá se ode dne
 * žádosti. Neznámý druh → bez lhůty (admin ji doplní ručně).
 */
const RESOLVE_DAYS: Record<string, number> = {
  reklamace: 30,
  vraceni: 14,
  odstoupeni: 14,
}

const resolveByFor = (kind: string | undefined): Date | null => {
  const days = kind ? RESOLVE_DAYS[kind] : undefined
  return days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null
}

/** The real person's name, or null — never a stored „Vážený zákazníku". */
const realCustomerName = (order: any): string | null => {
  const name = customerName(order)
  return name === "Vážený zákazníku" ? null : name
}

// Fotky vady / zboží — stejný kontrakt jako `store/made-to-order/media`:
// base64 (s `data:` prefixem i bez), limit počtu a velikosti, jen obrázky.
const MAX_PHOTOS = 6
const MAX_PHOTO_BYTES = 6 * 1024 * 1024
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
])

const decodePhoto = (data: string): Buffer => {
  const comma = data.indexOf(",")
  const payload =
    data.startsWith("data:") && comma > -1 ? data.slice(comma + 1) : data
  return Buffer.from(payload, "base64")
}

const safePhotoName = (filename: string): string => {
  const cleaned = filename
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-120)
  return cleaned || "reklamace-foto"
}

/**
 * Nahraje fotky vady do úložiště a vrátí jejich URL. Volá se AŽ po ověření
 * vlastnictví (číslo + e-mail), takže anonym nemá jak něco nahrát. Chybná fotka
 * (špatný formát / prázdná / moc velká) se přeskočí — žádost o reklamaci kvůli
 * jedné fotce nepadá.
 */
const uploadReturnPhotos = async (
  req: MedusaRequest,
  photos: { filename: string; mime_type: string; data: string }[]
): Promise<string[]> => {
  const prepared = photos
    .slice(0, MAX_PHOTOS)
    .map((photo) => {
      if (!ALLOWED_MIME.has(photo.mime_type.toLowerCase())) return null
      const buffer = decodePhoto(photo.data)
      if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) return null
      return {
        filename: safePhotoName(photo.filename),
        mimeType: photo.mime_type,
        content: buffer.toString("base64"),
        access: "public" as const,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  if (!prepared.length) return []

  try {
    const fileModule = req.scope.resolve(Modules.FILE)
    const uploaded = await fileModule.createFiles(prepared)
    return (Array.isArray(uploaded) ? uploaded : [uploaded])
      .map((file: any) => file?.url)
      .filter((url: unknown): url is string => typeof url === "string")
  } catch {
    // Úložiště je doplněk — bez fotek žádost platí dál (zákazník je dopošle).
    return []
  }
}

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
    fields: [
      "id",
      "display_id",
      "email",
      "customer.first_name",
      "customer.last_name",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "billing_address.first_name",
      "billing_address.last_name",
    ],
    filters: { display_id: displayId },
  })
  const order = orders[0] as any

  if (
    !order?.email ||
    order.email.trim().toLowerCase() !== body.email.toLowerCase()
  ) {
    return res.status(200).json(GENERIC_RESPONSE)
  }

  const service = req.scope.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )

  // One open request per order. A second submit (double click, impatience)
  // must not create a second row or a second pair of e-mails.
  const pending = await service.listReturnRequests({
    order_id: order.id,
    status: "pending",
  } as never)
  if (pending.length) {
    return res.status(200).json(GENERIC_RESPONSE)
  }

  // Fotky vady nahrajeme až TEĎ — po ověření vlastnictví, ať nejde zneužít
  // k anonymnímu plnění úložiště. Výsledek jsou URL, která uložíme k žádosti.
  const photoUrls = body.photos?.length
    ? await uploadReturnPhotos(req, body.photos)
    : []

  const request = await service.createReturnRequests({
    order_id: order.id,
    order_display_id: String(order.display_id),
    email: order.email,
    customer_name: realCustomerName(order) ?? undefined,
    kind: body.kind ?? null,
    resolve_by: resolveByFor(body.kind),
    reason: body.reason,
    // jsonb stores a bare string just fine; the generated DTO merely types the
    // json column as an object, hence the cast.
    items: (body.items?.length ? body.items : null) as unknown as Record<
      string,
      unknown
    >,
    photos: (photoUrls.length ? photoUrls : null) as unknown as Record<
      string,
      unknown
    >,
    status: "pending",
  })

  // Reklamační protokol (PDF) — zákonné písemné potvrzení o uplatnění. Uloží se
  // k žádosti a odkaz jde do potvrzovacího e-mailu. Chyba generování/úložiště
  // žádost neshodí (url zůstane null, protokol se dá vygenerovat později).
  const protocolNumber = protocolNumberFor(
    body.kind ?? null,
    String(order.display_id)
  )
  const protocol = await buildAndStoreProtocol(req.scope, {
    protocolNumber,
    kind: body.kind ?? null,
    orderDisplayId: String(order.display_id),
    customerName: realCustomerName(order),
    email: order.email,
    createdAt: new Date(),
    reason: request.reason,
    items: typeof body.items === "string" ? body.items : null,
  }).catch(() => ({ url: null as string | null, number: protocolNumber }))
  await service
    .updateReturnRequests({
      id: request.id,
      protocol_url: protocol.url,
      protocol_number: protocol.number,
    })
    .catch(() => undefined)

  // §16 confirmation to the customer. No `refundAmount`: nothing has been
  // decided yet, and the template only renders the amount row with a real one.
  await sendCustomerEmail(req.scope, {
    template: "refund-request",
    to: order.email,
    key: `refund-request:${request.id}`,
    orderId: order.id,
    data: {
      customerName: customerName(order),
      orderNumber: orderNumber(order),
      orderLink: orderLink(order),
      refundReason: request.reason,
      estimatedProcessingTime: "3–5 pracovních dnů",
      ...(protocol.url ? { protocolUrl: protocol.url } : {}),
    },
  })

  // She works from her inbox (D7), and an unanswered return request is a
  // customer left waiting — so this one is bell + e-mail, not bell-only.
  await notifyMerchant(req.scope, {
    key: `mn:return-req:${request.id}`,
    title: `Žádost o vrácení k objednávce #${order.display_id}`,
    description: [
      `Důvod: ${request.reason}`,
      body.items?.length ? `Objekty: ${body.items}` : null,
      photoUrls.length
        ? `${photoUrls.length} ${photoUrls.length === 1 ? "fotka" : "fotky"} vady`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
    audience: "owner",
    urgent: false,
    email: true,
    resource: { id: order.id, type: "order" },
  })

  return res.status(200).json(GENERIC_RESPONSE)
}
