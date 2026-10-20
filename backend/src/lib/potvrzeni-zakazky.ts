import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LEGAL_MANIFEST } from "./legal"
import type { EmailAttachmentRef } from "./legal/order-legal"
import { getLegalFacts } from "./merchant-settings"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"
import {
  confirmationFieldsFor,
  type CommissionConfirmationInput,
  type ConfirmationNoteLike,
  type ConfirmationOrderLike,
  type ConfirmationProductionOrderLike,
  type ConfirmationProfileLike,
} from "./potvrzeni-zakazky/fields"
import { generateCommissionConfirmationPdf, type ImageFetcher } from "./potvrzeni-zakazky/pdf"
import { storeCommissionConfirmation, type StoredConfirmation } from "./potvrzeni-zakazky/store"

/**
 * PDF „Potvrzení zakázky" (LEGAL_AUDIT § 0, Z11) — orchestrace: načíst
 * objednávku, produkční objednávku, profil výroby a právní údaje → namapovat
 * (`fields.ts`, čisté) → vysadit (`pdf.ts`, deterministické) → uložit
 * (`store.ts`, neměnné) → zapsat `confirmation_pdf_*` k produkční objednávce.
 *
 * Volá subscriber `commission-confirmation` (event
 * `made-to-order.production-order-created`) a později admin tlačítko
 * (`regenerateCommissionConfirmation`). Stejný obsah = stejný otisk = nic
 * nového v úložišti.
 */

export {
  confirmationFieldsFor,
  formatCzechDateTime,
  formatCzechMoney,
  isCommissionCheckoutOrder,
  NEUVEDENO,
  type CommissionConfirmationInput,
} from "./potvrzeni-zakazky/fields"
export { generateCommissionConfirmationPdf, type ImageFetcher } from "./potvrzeni-zakazky/pdf"
export {
  confirmationKeyFor,
  confirmationVersionKeyFor,
  planConfirmationStorage,
  sha256Hex,
  storeCommissionConfirmation,
  type StoredConfirmation,
} from "./potvrzeni-zakazky/store"

/** Název přílohy v potvrzovacím e-mailu: `Potvrzeni-zakazky-<číslo>.pdf`. */
export const confirmationAttachmentFilename = (displayId: unknown): string =>
  `Potvrzeni-zakazky-${String(displayId ?? "").replace(/[^0-9A-Za-z_-]/g, "") || "objednavka"}.pdf`

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "created_at",
  "currency_code",
  "total",
  "shipping_total",
  "metadata",
  "items.*",
  // Zakázka na míru — stejná detekce jako modul reklamací (lib/claims/made-to-order).
  "items.product.metadata",
  "items.product.categories.handle",
  "shipping_address.*",
  "billing_address.*",
  "customer.*",
  "shipping_methods.*",
  "payment_collections.amount",
  "payment_collections.status",
  "payment_collections.metadata",
  "payment_collections.payments.id",
  "payment_collections.payment_sessions.provider_id",
  "payment_collections.payment_sessions.status",
]

export type ConfirmationContext = {
  order: ConfirmationOrderLike & { id: string; display_id?: number | string | null }
  productionOrder: (ConfirmationProductionOrderLike & { id: string }) | null
  profile: ConfirmationProfileLike
  notes: ConfirmationNoteLike[]
}

/** Vše, co mapování potřebuje, z databáze — bez právních údajů (ty jdou zvlášť, nikdy nevyhodí). */
export const loadConfirmationContext = async (
  container: MedusaContainer,
  orderId: string
): Promise<ConfirmationContext | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const madeToOrder = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = orders?.[0] as ConfirmationContext["order"] | undefined
  if (!order) return null

  const [productionOrder] = (await madeToOrder.listProductionOrders({ order_id: orderId } as never)) as any[]
  if (productionOrder) {
    productionOrder.payment_requests = (await madeToOrder.listProductionPaymentRequests({
      production_order_id: productionOrder.id,
    } as never)) as any[]
  }

  // Lhůta výroby: profil produktu zakázkového řádku, přebití u provedení vyhrává.
  let profile: ConfirmationProfileLike = null
  const commissionItems = (order.items ?? []).filter(
    (item) => item && (item.metadata as any)?.made_to_order
  )
  for (const item of commissionItems.length ? commissionItems : order.items ?? []) {
    if (!item?.product_id) continue
    const [productProfile] = (await madeToOrder.listProductProductionProfiles({
      product_id: item.product_id,
    } as never)) as any[]
    if (!productProfile) continue
    const [variantProfile] = item.variant_id
      ? ((await madeToOrder.listVariantProductionProfiles({ variant_id: item.variant_id } as never)) as any[])
      : []
    profile = {
      production_time_min_days:
        variantProfile?.production_time_min_days_override ?? productProfile.production_time_min_days,
      production_time_max_days:
        variantProfile?.production_time_max_days_override ?? productProfile.production_time_max_days,
    }
    break
  }

  const notes = (await madeToOrder
    .listProductionNotes({ order_id: orderId, created_by: "customer" } as never, {
      order: { created_at: "ASC" },
    } as never)
    .catch(() => [])) as ConfirmationNoteLike[]

  return { order, productionOrder: productionOrder ?? null, profile, notes }
}

/** Hostitelé, odkud se fotky zadání smí stáhnout — naše úložiště a web (z prostředí). */
export const allowedImageHosts = (env: NodeJS.ProcessEnv = process.env): Set<string> => {
  const hosts = new Set<string>()
  for (const key of ["R2_PUBLIC_URL", "MINIO_ENDPOINT", "STOREFRONT_PUBLIC_URL", "MEDUSA_STOREFRONT_URL", "MEDUSA_BACKEND_URL"]) {
    const raw = (env[key] || "").trim()
    if (!raw) continue
    try {
      hosts.add(new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).host.toLowerCase())
    } catch {
      // Nesmyslná hodnota v prostředí — fotka se prostě nestáhne.
    }
  }
  return hosts
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/**
 * Stažení fotky zadání pro miniaturu v PDF: jen https z našich domén, do
 * 10 MB, 8 s. Cokoli jiného → null → v PDF rámeček „foto u objednávky".
 */
export const fetchConfirmationImage: ImageFetcher = async (url) => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== "https:" || !allowedImageHosts().has(parsed.host.toLowerCase())) {
    return null
  }
  try {
    const response = await fetch(parsed.toString(), { signal: AbortSignal.timeout(8000) })
    if (!response.ok) return null
    const length = Number(response.headers.get("content-length") ?? 0)
    if (length > MAX_IMAGE_BYTES) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    return bytes.length > MAX_IMAGE_BYTES ? null : bytes
  } catch {
    return null
  }
}

export type CommissionConfirmationResult = StoredConfirmation & {
  attachment: EmailAttachmentRef
  fields: CommissionConfirmationInput
  warnings: string[]
}

/**
 * Vygeneruje, uloží a zapíše Potvrzení zakázky k objednávce. Vyhodí, když
 * objednávka nebo produkční objednávka neexistuje nebo selže generování či
 * upload — volající (subscriber) chybu zaloguje a potvrzení objednávky pošle
 * bez přílohy. `confirmation_sent_at` tahle funkce NEnastavuje (to až po
 * odeslání e-mailu).
 */
export const buildCommissionConfirmation = async (
  container: MedusaContainer,
  orderId: string,
  options: { fetchImage?: ImageFetcher } = {}
): Promise<CommissionConfirmationResult> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const madeToOrder = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)

  const context = await loadConfirmationContext(container, orderId)
  if (!context) throw new Error(`Objednávka ${orderId} neexistuje.`)
  if (!context.productionOrder) throw new Error(`Objednávka ${orderId} nemá produkční objednávku (zakázku).`)

  const { facts } = await getLegalFacts(container)
  const { fields, warnings } = confirmationFieldsFor({
    order: context.order,
    productionOrder: context.productionOrder,
    profile: context.profile,
    facts,
    manifest: LEGAL_MANIFEST,
    notes: context.notes,
  })
  for (const warning of warnings) {
    logger.warn(`[potvrzení zakázky] #${context.order.display_id ?? "?"}: ${warning}`)
  }

  const bytes = await generateCommissionConfirmationPdf(fields, {
    fetchImage: options.fetchImage ?? fetchConfirmationImage,
  })
  const previous = context.productionOrder as any
  const stored = await storeCommissionConfirmation(container, orderId, bytes, {
    key: previous.confirmation_pdf_key,
    url: previous.confirmation_pdf_url,
    sha256: previous.confirmation_pdf_sha256,
  })

  const changed =
    stored.key !== previous.confirmation_pdf_key ||
    stored.url !== previous.confirmation_pdf_url ||
    stored.sha256 !== previous.confirmation_pdf_sha256 ||
    (fields.terms.version_raw ?? null) !== (previous.confirmation_terms_version ?? null)
  if (changed) {
    await madeToOrder.updateProductionOrders({
      id: context.productionOrder.id,
      confirmation_pdf_key: stored.key,
      confirmation_pdf_url: stored.url,
      confirmation_pdf_sha256: stored.sha256,
      confirmation_terms_version: fields.terms.version_raw,
    } as never)
  }
  logger.info(
    `[potvrzení zakázky] #${context.order.display_id ?? "?"}: PDF ${stored.uploaded ? "uloženo" : "beze změny"} (${stored.key}, sha256 ${stored.sha256.slice(0, 8)}…).`
  )

  return {
    ...stored,
    attachment: { filename: confirmationAttachmentFilename(context.order.display_id), url: stored.url },
    fields,
    warnings,
  }
}

/**
 * Opakované vygenerování (admin tlačítko, později): stejný obsah → stejný
 * otisk → nic nového; jiný obsah → nová verze vedle, stará zůstává.
 */
export const regenerateCommissionConfirmation = (
  container: MedusaContainer,
  orderId: string
): Promise<CommissionConfirmationResult> => buildCommissionConfirmation(container, orderId)
