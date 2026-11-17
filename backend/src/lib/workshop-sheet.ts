import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { voucherNoteForOrder } from "./gift-voucher-orders"
import type { EmailAttachmentRef } from "./legal/order-legal"
import { listCommissionsOfOrder, paymentRequestsByCommission } from "./made-to-order/orders-of"
import { LINE_QUANTITY_FIELDS } from "./order-quantity"
import { fetchConfirmationImage } from "./potvrzeni-zakazky"
import { resolveFixedKeyProvider, sha256Hex } from "./potvrzeni-zakazky/store"
import { workshopSheetData, workshopSheetFilename, type WorkshopSheet } from "./workshop-sheet/data"
import { generateWorkshopSheetPdf, type SheetImageFetcher } from "./workshop-sheet/pdf"

export { workshopSheetData, workshopSheetFilename, paymentRows } from "./workshop-sheet/data"
export type { WorkshopSheet } from "./workshop-sheet/data"
export { generateWorkshopSheetPdf } from "./workshop-sheet/pdf"

/**
 * List pro dílnu — PDF se vším, co dílna k objednávce potřebuje (zákazník,
 * doprava, položky s příznaky, zadání zakázek, stav platby a místo na
 * poznámky). Chodí v příloze e-mailu majitelce o nové objednávce
 * (`subscribers/merchant-notifications.ts`) a stahuje se tlačítkem
 * v administraci (`GET /admin/orders/:id/workshop-sheet`).
 *
 * Vyrábí se vždy načerstvo z dnešních dat — nic se k objednávce neukládá.
 */

export const WORKSHOP_ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "created_at",
  "currency_code",
  // `items.*` je nutné, aby se `total` vůbec spočítal.
  "total",
  "shipping_total",
  "metadata",
  "items.*",
  // Množství dopočítává projekce `items.*`; detail jako pojistka pro `lineQuantityOf`.
  ...LINE_QUANTITY_FIELDS.filter((field) => field.startsWith("items.detail.")),
  "items.product.metadata",
  "shipping_address.*",
  "billing_address.*",
  "customer.first_name",
  "customer.last_name",
  "customer.email",
  "customer.phone",
  "shipping_methods.*",
  "payment_collections.*",
  "payment_collections.payments.*",
  "payment_collections.payment_sessions.provider_id",
  "payment_collections.payment_sessions.status",
]

/** Data listu z databáze, nebo null, když objednávka neexistuje. */
export const loadWorkshopSheet = async (
  container: MedusaContainer,
  orderId: string
): Promise<{ sheet: WorkshopSheet; order: any } | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: WORKSHOP_ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = (orders?.[0] as any) ?? null
  if (!order) return null

  const commissions = (await listCommissionsOfOrder(container, orderId)) as any[]
  const requests = await paymentRequestsByCommission(container, commissions)
  for (const commission of commissions) {
    commission.payment_requests = requests.get(commission.id) ?? []
  }

  const voucherNote = await voucherNoteForOrder(container, orderId)
  return { sheet: workshopSheetData({ order, commissions, voucher_note: voucherNote }), order }
}

/** PDF + název souboru, nebo null, když objednávka neexistuje. */
export const buildWorkshopSheet = async (
  container: MedusaContainer,
  orderId: string,
  options: { fetchImage?: SheetImageFetcher | null } = {}
): Promise<{ bytes: Buffer; filename: string; order: any } | null> => {
  const loaded = await loadWorkshopSheet(container, orderId)
  if (!loaded) return null
  const createdAt = new Date(loaded.order.created_at ?? Date.now())
  const bytes = await generateWorkshopSheetPdf(loaded.sheet, {
    // `null` = bez stahování fotek; výchozí jen https z našich domén (8 s, 10 MB).
    fetchImage: options.fetchImage === null ? undefined : options.fetchImage ?? fetchConfirmationImage,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
  })
  return { bytes: Buffer.from(bytes), filename: workshopSheetFilename(loaded.order.display_id), order: loaded.order }
}

/** List pro dílnu objednávky jako PDF; neexistující objednávka = NOT_FOUND. */
export const buildWorkshopSheetPdf = async (container: MedusaContainer, orderId: string): Promise<Buffer> => {
  const built = await buildWorkshopSheet(container, orderId)
  if (!built) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }
  return built.bytes
}

/**
 * Uloží list do úložiště a vrátí přílohu e-mailu (Resend si ji stáhne podle
 * adresy), nebo null. List nese jméno, adresu a telefon — klíč proto
 * obsahuje otisk obsahu (neuhádnutelný), stejně jako prezenční listina
 * a potvrzení zakázek. Bez pevných klíčů (sandbox) obyčejný upload; adresa
 * bez https se do e-mailu nedostane (Resend provider ji vynechá).
 */
export const storeWorkshopSheet = async (
  container: MedusaContainer,
  orderId: string
): Promise<EmailAttachmentRef | null> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const built = await buildWorkshopSheet(container, orderId)
  if (!built) return null
  const { bytes, filename } = built
  const safeId = orderId.replace(/[^0-9A-Za-z_-]/g, "")
  const provider = resolveFixedKeyProvider(container)
  if (!provider) {
    const fileModule = container.resolve(Modules.FILE) as any
    const [file] = await fileModule.createFiles([
      {
        filename: `${filename.replace(/\.pdf$/i, "")}-${sha256Hex(bytes).slice(0, 16)}.pdf`,
        mimeType: "application/pdf",
        content: bytes.toString("base64"),
        access: "public",
      },
    ])
    if (!file?.url) {
      logger.warn(`[list pro dílnu] PDF objednávky ${orderId} se nepodařilo uložit — e-mail odejde bez něj.`)
      return null
    }
    return { filename, url: file.url }
  }
  const key = `orders/${safeId}/dilna/${filename.replace(/\.pdf$/i, "")}-${sha256Hex(bytes).slice(0, 16)}.pdf`
  const url = (await provider.objectExistsAtKey(key))
    ? provider.publicUrlForKey(key)
    : (await provider.putObjectAtKey(key, bytes, "application/pdf")).url
  return { filename, url }
}
