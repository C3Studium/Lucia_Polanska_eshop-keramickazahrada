import { ContainerRegistrationKeys, generateJwtToken } from "@medusajs/framework/utils"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import { COURSE_MODULE } from "../modules/course"
import { GIFT_VOUCHER_MODULE } from "../modules/gift-voucher"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import { customAddToCartWorkflow } from "../workflows/custom-add-to-cart"
import { isClearanceProduct, isSoldOut } from "./clearance"
import { signCourseReservationToken } from "./course-reservation-link"
import { signGiftVoucherToken } from "./gift-voucher-link"
import { isAgreedPriceCommission } from "./made-to-order/agreed-price"
import { signOrderAccessToken } from "./order-access-link"
import { isPriceOnRequest } from "./price-on-request"
import { isGiftVoucherProduct } from "./gift-voucher-orders"

/**
 * Ukázková data pro Studio (ValeCMS).
 *
 * Studio ukazuje stránky webu v rámu, aby šly upravit texty. Stránky, které
 * potřebují objednávku, token, rezervaci nebo poukaz (`/order/:id/confirmed`,
 * `/kurzy/rezervace/:id?token=…`), by v rámu skončily na 404. Storefront proto
 * má vyhrazené adresy (`/cz/order/ukazka/confirmed` …) a přihlášenému
 * redaktorovi Studia je přepíše na skutečná data odsud — viz storefront
 * `src/lib/studio-preview`.
 *
 * Bere se to, co v obchodě opravdu je: nejnovější objednávka, zakázka,
 * rezervace, poukaz, jeden výrobek od každého druhu. Nic se nezakládá — kromě
 * ukázkového košíku (`ensureStudioPreviewCart`), bez e-mailu a s
 * `metadata.preview`, takže z něj nikdy neodejde e-mail o nedokončeném nákupu.
 *
 * Každý dotaz zvlášť: když jeden selže, chybí jen jeho ukázka, ne všechny.
 */

export type PreviewRef = { id: string; token: string }

export type ProductKind =
  | "giftVoucher"
  | "priceOnRequest"
  | "madeToOrder"
  | "clearance"
  | "soldOut"
  | "regular"

export type StudioPreviewData = {
  order: PreviewRef | null
  commissionOrder: PreviewRef | null
  priceOnRequestOrder: PreviewRef | null
  awaitingBalanceOrder: PreviewRef | null
  courseReservation: PreviewRef | null
  paidVoucher: PreviewRef | null
  pendingVoucher: PreviewRef | null
  /** Handle výrobku od každého druhu, nebo null. */
  products: Record<ProductKind, string | null>
  /** Handle kategorie a kolekce pro jejich stránky. */
  categoryHandle: string | null
  collectionHandle: string | null
}

export type PreviewProductInput = {
  handle?: string | null
  metadata?: Record<string, unknown> | null
  variants?: any[] | null
  /** Má zapnutý výrobní profil (modul made-to-order). */
  hasProductionProfile?: boolean
}

const safe = async <T>(run: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await run()
  } catch {
    return fallback
  }
}

/** Sledovaný sklad je všude pryč a žádná varianta nejde na objednávku. */
const outOfStock = (variants: any[]): boolean => {
  const tracked = (variants || []).filter((variant) => variant?.manage_inventory)
  if (!tracked.length) return false
  if (tracked.some((variant) => variant?.allow_backorder)) return false
  return isSoldOut(tracked)
}

/** Jaká stránka výrobku to je — nejkonkrétnější druh vyhrává. */
export const productKind = (product: PreviewProductInput): ProductKind => {
  const metadata = product.metadata ?? null
  if (isGiftVoucherProduct(metadata)) return "giftVoucher"
  if (isPriceOnRequest(metadata)) return "priceOnRequest"
  if (metadata?.made_to_order === true || metadata?.made_to_order === "true" || product.hasProductionProfile) {
    return "madeToOrder"
  }
  if (isClearanceProduct(product)) return "clearance"
  if (outOfStock(product.variants ?? [])) return "soldOut"
  return "regular"
}

/** První výrobek od každého druhu v daném pořadí (volající dává od nejnovějšího). */
export const pickProducts = (products: PreviewProductInput[]): Record<ProductKind, string | null> => {
  const picked: Record<ProductKind, string | null> = {
    regular: null,
    madeToOrder: null,
    priceOnRequest: null,
    giftVoucher: null,
    clearance: null,
    soldOut: null,
  }
  for (const product of products) {
    if (!product?.handle) continue
    const kind = productKind(product)
    if (!picked[kind]) picked[kind] = product.handle
  }
  return picked
}

const orderRef = (id?: string | null): PreviewRef | null =>
  id ? { id, token: signOrderAccessToken(id) } : null

const PRODUCT_FIELDS = [
  "id",
  "handle",
  "title",
  "metadata",
  "sales_channels.id",
  "variants.id",
  "variants.manage_inventory",
  "variants.allow_backorder",
  "variants.inventory.location_levels.stocked_quantity",
  "variants.inventory.location_levels.reserved_quantity",
]

const readProducts = async (scope: any) => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: PRODUCT_FIELDS,
    filters: { status: "published" },
    pagination: { take: 500, skip: 0, order: { created_at: "DESC" } },
  })
  const profiled = await safe(async () => {
    const service = scope.resolve(MADE_TO_ORDER_MODULE) as any
    const profiles = (await service.listProductProductionProfiles(
      { product_id: (data as any[]).map((p) => p.id) },
      { take: 1000 }
    )) as any[]
    return new Set(profiles.filter((p) => p?.enabled).map((p) => p.product_id as string))
  }, new Set<string>())
  return (data as any[]).map((product) => ({ ...product, hasProductionProfile: profiled.has(product.id) }))
}

export const readStudioPreviewData = async (scope: any): Promise<StudioPreviewData> => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const latestOrderId = await safe(async () => {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id"],
      pagination: { take: 1, skip: 0, order: { created_at: "DESC" } },
    })
    return ((data as any[])[0]?.id as string) ?? null
  }, null)

  const productionOrders = await safe(async () => {
    const service = scope.resolve(MADE_TO_ORDER_MODULE) as any
    return (await service.listProductionOrders({}, { take: 100, order: { created_at: "DESC" } })) as any[]
  }, [] as any[])

  const courseReservation = await safe(async () => {
    const service = scope.resolve(COURSE_MODULE) as any
    const [row] = await service.listCourseReservations({}, { take: 1, order: { created_at: "DESC" } })
    return row ? { id: row.id as string, token: signCourseReservationToken(row.id) } : null
  }, null)

  const voucherOf = (payment_status: "paid" | "pending") =>
    safe(async () => {
      const service = scope.resolve(GIFT_VOUCHER_MODULE) as any
      const [row] = await service.listGiftVouchers({ payment_status }, { take: 1, order: { created_at: "DESC" } })
      return row ? { id: row.id as string, token: signGiftVoucherToken(row.id) } : null
    }, null)
  const [paidVoucher, pendingVoucher] = await Promise.all([voucherOf("paid"), voucherOf("pending")])

  const products = await safe(async () => pickProducts(await readProducts(scope)), pickProducts([]))

  const firstHandle = (entity: string, filters: Record<string, unknown> = {}) =>
    safe(async () => {
      const { data } = await query.graph({
        entity,
        fields: ["handle"],
        filters,
        pagination: { take: 1, skip: 0, order: { created_at: "ASC" } },
      })
      return ((data as any[])[0]?.handle as string) ?? null
    }, null)
  const [categoryHandle, collectionHandle] = await Promise.all([
    firstHandle("product_category", { is_active: true, parent_category_id: null }),
    firstHandle("product_collection"),
  ])

  return {
    order: orderRef(latestOrderId),
    commissionOrder: orderRef(productionOrders[0]?.order_id),
    priceOnRequestOrder: orderRef(productionOrders.find((p) => isAgreedPriceCommission(p))?.order_id),
    awaitingBalanceOrder: orderRef(productionOrders.find((p) => p?.stage === "awaiting_balance")?.order_id),
    courseReservation,
    paidVoucher,
    pendingVoucher,
    products,
    categoryHandle,
    collectionHandle,
  }
}

/* ---------------------------------------------------------- účet zákazníka -- */

/** Token zákazníka žije krátce — storefront ho podstrčí jen do vykreslení v rámu Studia. */
const CUSTOMER_TOKEN_TTL = "15m"

/**
 * Přihlášení za zákazníka pro stránky účtu (Přehled, Objednávky, Adresy…).
 *
 * Bere se zákazník s účtem z nejnovější objednávky — prázdný účet by ukázal
 * jen prázdné stavy. Token je stejný, jaký Medusa vydá při přihlášení
 * (`generateJwtTokenForAuthIdentity`), jen s platností 15 minut. Storefront ho
 * nedá do prohlížeče: vloží ho do cookies jednoho požadavku, takže v rámu jde
 * účet prohlížet, ale ne v něm jednat.
 */
export const mintStudioPreviewCustomer = async (
  scope: any
): Promise<{ token: string; order_id: string | null } | null> => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const config = scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as any
  const secret = config?.projectConfig?.http?.jwtSecret
  if (!secret) return null

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "customer_id", "customer.has_account", "customer.metadata"],
    pagination: { take: 50, skip: 0, order: { created_at: "DESC" } },
  })
  const { data: identities } = await query.graph({
    entity: "auth_identity",
    fields: ["id", "app_metadata", "provider_identities.provider", "provider_identities.user_metadata"],
  })
  const identityOf = (customerId: string) =>
    (identities as any[]).find((identity) => identity?.app_metadata?.customer_id === customerId)

  // Ověřený e-mail napřed: neověřený účet ukáže jen „Zkontrolujte poštu" (layout účtu).
  const verified = (order: any) => order?.customer?.metadata?.email_verified ? 0 : 1
  const candidates = [...(orders as any[])].sort((a, b) => verified(a) - verified(b))
  for (const order of candidates) {
    if (!order?.customer_id || !order?.customer?.has_account) continue
    const identity = identityOf(order.customer_id)
    if (!identity) continue
    const provider = (identity.provider_identities ?? [])[0]
    const token = generateJwtToken(
      {
        actor_id: order.customer_id,
        actor_type: "customer",
        auth_identity_id: identity.id,
        ...(provider?.provider ? { auth_provider: provider.provider } : {}),
        app_metadata: { ...(identity.app_metadata ?? {}), customer_id: order.customer_id },
        user_metadata: provider?.user_metadata ?? {},
      },
      { secret, expiresIn: CUSTOMER_TOKEN_TTL, jwtOptions: config?.projectConfig?.http?.jwtOptions }
    )
    return { token, order_id: order.id }
  }
  return null
}

/* ------------------------------------------------------------ ukázkový košík -- */

type Variant = {
  id: string
  manage_inventory?: boolean
  allow_backorder?: boolean
  inventory?: Array<{ location_levels?: Array<{ stocked_quantity?: unknown; reserved_quantity?: unknown }> }>
}

const available = (variant: Variant): number =>
  (variant.inventory ?? [])
    .flatMap((item) => item?.location_levels ?? [])
    .reduce(
      (sum, level) => sum + (Number(level?.stocked_quantity ?? 0) - Number(level?.reserved_quantity ?? 0)),
      0
    )

/** Ukázkový košík žije týden; pak se založí nový (ceny a sklad se mezitím mění). */
const PREVIEW_CART_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Košík pro Košík a Pokladnu ve Studiu: jeden sdílený, dokud je čerstvý.
 *
 * Bez e-mailu a s `metadata.preview = true` — job opuštěných košíků ho
 * přeskakuje (`jobs/send-abandoned-cart-notification.ts`), i kdyby do něj
 * někdo v pokladně vepsal adresu. Storefront ho redaktorovi jen podstrčí
 * do jednoho vykreslení (cookie v požadavku, ne v prohlížeči), takže v něm
 * nikdo nic nedokončí.
 */
export const ensureStudioPreviewCart = async (scope: any): Promise<string | null> => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)

  const existing = await safe(async () => {
    const { data } = await query.graph({
      entity: "cart",
      fields: ["id", "metadata", "created_at", "completed_at", "items.id"],
      filters: { completed_at: null, email: null },
      pagination: { take: 50, skip: 0, order: { created_at: "DESC" } },
    })
    return (data as any[]).find(
      (cart) =>
        cart?.metadata?.preview === true &&
        cart?.metadata?.preview_source === "studio" &&
        (cart.items ?? []).length > 0 &&
        Date.now() - new Date(cart.created_at).getTime() < PREVIEW_CART_MAX_AGE_MS
    )
  }, null)
  if (existing?.id) return existing.id as string

  const country = (process.env.STOREFRONT_COUNTRY || "cz").toLowerCase()
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code", "countries.iso_2"],
  })
  const region = (regions as any[]).find((candidate) =>
    (candidate.countries ?? []).some((c: any) => String(c?.iso_2 ?? "").toLowerCase() === country)
  )
  if (!region) return null

  const products = await readProducts(scope)
  const pick = (kind: ProductKind, requireStock: boolean) => {
    for (const product of products) {
      if (!(product.sales_channels ?? []).length) continue
      if (productKind(product) !== kind) continue
      const variants = (product.variants ?? []) as Variant[]
      const variant = requireStock
        ? variants.find((v) => !v.manage_inventory || available(v) > 0)
        : variants.find((v) => !v.manage_inventory || available(v) > 0 || v.allow_backorder)
      if (variant) return { product, variant }
    }
    return null
  }
  const regular = pick("regular", true) ?? pick("regular", false)
  if (!regular) return null
  const extras = [pick("madeToOrder", false), pick("priceOnRequest", false)].filter(Boolean) as Array<
    NonNullable<ReturnType<typeof pick>>
  >
  const salesChannelId = regular.product.sales_channels[0].id as string

  const { result: cart } = await createCartWorkflow(scope).run({
    input: {
      region_id: region.id,
      currency_code: region.currency_code,
      sales_channel_id: salesChannelId,
      metadata: { preview: true, preview_source: "studio", preview_created_at: new Date().toISOString() },
    },
  })

  let added = 0
  for (const entry of [regular, ...extras]) {
    if (!(entry.product.sales_channels ?? []).some((sc: any) => sc?.id === salesChannelId)) continue
    try {
      await customAddToCartWorkflow(scope).run({
        input: { cart_id: cart.id, item: { variant_id: entry.variant.id, quantity: 1 } },
      })
      added += 1
    } catch (error) {
      logger.warn(`[studio-preview] ${entry.product.title} se do ukázkového košíku nevešel: ${(error as Error)?.message}`)
    }
  }
  return added ? cart.id : null
}
