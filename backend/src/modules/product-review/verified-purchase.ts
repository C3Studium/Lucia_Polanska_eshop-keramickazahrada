/**
 * „Ověřený nákup" u recenze — čistá část (§ 5 ZOS, klamavé praktiky).
 *
 * Štítek dřív visel u každé recenze, i když se nic neověřovalo. Teď ho dostane
 * jen recenze zákazníka, který výrobek u nás koupil:
 *
 * 1. objednávka **jeho účtu** (`order.customer_id`), nebo
 * 2. objednávka na **jeho ověřený e-mail** (`customer.metadata.email_verified`)
 *    — host, který nakoupil bez účtu a účet si založil až kvůli recenzi.
 *    Medusa hostovskou objednávku k novému účtu nepřipojí (účet je nový
 *    záznam zákazníka), takže bez téhle cesty by štítek nedostal nikdo, kdo
 *    přišel z e-mailu s prosbou o recenzi. E-mail musí být ověřený odkazem,
 *    jinak by si štítek mohl „vypůjčit" kdokoli, kdo zná cizí adresu.
 *
 * Objednávka se počítá, když obsahuje řádek s tímto výrobkem a není zrušená
 * ani koncept (draft). Vrácení zboží štítek nebere — zákazník výrobek koupil
 * a měl ho v ruce, což je přesně to, co štítek tvrdí.
 */

export type PurchaseOrderLike = {
  status?: string | null
  is_draft_order?: boolean | null
  email?: string | null
  items?: Array<{ product_id?: string | null } | null> | null
} | null

/** Stavy objednávky, které nákup nejsou. */
export const NON_PURCHASE_ORDER_STATUSES: ReadonlySet<string> = new Set([
  "canceled",
  "draft",
])

export const orderCountsAsPurchase = (order: PurchaseOrderLike): boolean =>
  Boolean(order) &&
  !order!.is_draft_order &&
  !NON_PURCHASE_ORDER_STATUSES.has(String(order!.status ?? "").toLowerCase())

export const orderContainsProduct = (
  order: PurchaseOrderLike,
  productId: string
): boolean =>
  orderCountsAsPurchase(order) &&
  (order!.items ?? []).some((item) => item?.product_id === productId)

const normalizeEmail = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : ""

export type VerifiedPurchaseInput = {
  product_id: string
  /** Objednávky účtu recenzenta (`customer_id`). */
  account_orders: PurchaseOrderLike[]
  /** E-mail účtu recenzenta. */
  customer_email?: string | null
  /** Byl e-mail účtu ověřen odkazem? */
  email_verified?: boolean
  /** Objednávky dohledané podle e-mailu (může jít o hrubý výběr — přesná
      shoda adresy se kontroluje tady). */
  email_orders?: PurchaseOrderLike[]
}

export const isVerifiedPurchase = (input: VerifiedPurchaseInput): boolean => {
  if (!input.product_id) return false

  if (input.account_orders.some((order) => orderContainsProduct(order, input.product_id))) {
    return true
  }

  const email = normalizeEmail(input.customer_email)
  if (!email || input.email_verified !== true) return false

  return (input.email_orders ?? []).some(
    (order) =>
      normalizeEmail(order?.email) === email &&
      orderContainsProduct(order, input.product_id)
  )
}
