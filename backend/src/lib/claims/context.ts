import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMerchantSettings } from "../merchant-settings"
import { LINE_QUANTITY_FIELDS } from "../order-quantity"
import { PARCEL_TRACKING_MODULE } from "../../modules/parcel-tracking"
import type ParcelTrackingModuleService from "../../modules/parcel-tracking/service"
import { RETURN_REQUEST_MODULE } from "../../modules/return-request"
import type ReturnRequestModuleService from "../../modules/return-request/service"
import {
  blocksNewClaim,
  blocksWithdrawal,
  isDamageCause,
} from "./constants"
import { claimLineItemsOf, orderItemsForClaims } from "./line-items"
import { isMadeToOrderItem } from "./made-to-order"
import { goodsShipped } from "./money"
import {
  capturedTotal,
  MONEY_EPSILON,
  requestRefunds,
  requestRefundedTotal,
} from "./refund-rules"
import { refundAccountNeeded, storedRefundAccount } from "./refund-account"
import {
  formatPragueDate,
  formatPragueDateTime,
  refundMethodTextFor,
  takeoverTextFor,
  withdrawalItemsOf,
  withdrawalReturnAddress,
  withdrawalTimingFor,
  type RefundMethodKind,
  type TakeoverBasis,
} from "./withdrawal"
import { isServiceLine } from "../packaging-lines"

/**
 * Kontext „Reklamace a vrácení" pro zákazníka (docs/reklamace-a-zruseni.md §4,
 * `GET /store/orders/:id/claims`) a sdílené výpočty, které z něj potřebuje i
 * intake (§1837, 14denní lhůta, jedna otevřená žádost).
 *
 * Gating se počítá NA SERVERU a storefront ho jen zobrazuje — pravidlo, které
 * hlídá jen prohlížeč, přestane platit při prvním ručním requestu.
 *
 * Od 14. 10. 2026 (odstoupení online, § 1830a OZ) navíc blok `withdrawal`:
 * předvyplněná data formuláře odstoupení (jméno, e-mail, číslo a datum
 * objednávky, převzetí, položky s vyznačenou zakázkou, způsob vrácení peněz)
 * a lhůta počítaná od PŘEVZETÍ (`lib/claims/withdrawal.ts`).
 */

export { isMadeToOrderItem } from "./made-to-order"

export type ClaimOrderItem = {
  id?: string
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  thumbnail?: string | null
  unit_price?: unknown
  total?: unknown
  quantity?: unknown
  raw_quantity?: unknown
  detail?: { quantity?: unknown; raw_quantity?: unknown } | null
  metadata?: Record<string, unknown> | null
  product?: {
    metadata?: Record<string, unknown> | null
    categories?: Array<{ handle?: string | null } | null> | null
  } | null
}

export type ClaimOrderFulfillment = {
  shipped_at?: string | Date | null
  delivered_at?: string | Date | null
  canceled_at?: string | Date | null
  data?: Record<string, unknown> | null
  labels?: Array<{ tracking_number?: string | null }> | null
}

export type ClaimParcelTracking = {
  delivered_at?: string | Date | null
  done?: boolean | null
}

export type ClaimOrder = {
  id: string
  display_id?: number | string
  email?: string | null
  status?: string | null
  created_at?: string | Date | null
  currency_code?: string | null
  metadata?: Record<string, unknown> | null
  items?: ClaimOrderItem[] | null
  fulfillments?: ClaimOrderFulfillment[] | null
  shipping_methods?: unknown[] | null
  /**
   * Řádek sledování zásilky ČP (`parcel_tracking`, jeden na objednávku) —
   * nese okamžik převzetí (`delivered_at`), který fulfillment nemá. Přibalí
   * ho `attachParcelTracking`; chybí-li, lhůta se odhadne z odeslání.
   */
  parcel_tracking?: ClaimParcelTracking | null
}

/**
 * Pole objednávky, která kontext i intake potřebují — jeden seznam pro obě routy.
 *
 * `total` + `items.*` jsou tu kvůli položkám (§11.1): teprve `total` na
 * objednávce spustí v modulu objednávek `decorateCartTotals`, který na řádky
 * dopočítá `item.total` PO slevě a S DPH (jinak řádek `total` vůbec nemá).
 * Množství se čte přes `lineQuantityOf` (`LINE_QUANTITY_FIELDS`) — výslovné
 * `items.quantity` z `query.graph` je nespolehlivé (lib/order-quantity).
 * `metadata` + `fulfillments.data/labels` = zdroje podacího čísla pro
 * reklamaci u dopravce (`parcelCodeOf`, §11.3).
 *
 * Odstoupení online (14. 10. 2026): `items.product.categories.handle` (zakázka
 * podle kategorie), `fulfillments.delivered_at` a dopravní metody (osobní
 * odběr = převzetí při vyzvednutí). Dopravní metody celé i s daněmi
 * a úpravami — stejná trojice jako `MONEY_ORDER_FIELDS`, s neúplnými řádky by
 * `decorateCartTotals` počítal dopravu z děr.
 */
export const CLAIM_ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "status",
  "created_at",
  "currency_code",
  "total",
  "metadata",
  "customer.first_name",
  "customer.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "billing_address.first_name",
  "billing_address.last_name",
  "items.*",
  ...LINE_QUANTITY_FIELDS,
  "items.product.metadata",
  "items.product.categories.handle",
  "shipping_methods.*",
  "shipping_methods.tax_lines.*",
  "shipping_methods.adjustments.*",
  "shipping_methods.shipping_option.provider_id",
  "fulfillments.id",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
  "fulfillments.data",
  "fulfillments.labels.tracking_number",
  // Auto-zrušení (§13.1): „nic zachyceno" se počítá ze zachycených plateb —
  // stejná pole jako `MONEY_STATE_FIELDS`, ať `capturedTotal` čte totéž.
  "payment_collections.payments.id",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.amount",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
  "payment_collections.payments.refunds.amount",
]

/**
 * Přibalí k objednávce řádek sledování ČP (`order.parcel_tracking`). Modul
 * sledování není s objednávkou propojený linkem, proto zvlášť přes službu
 * (stejně jako job `request-reviews`). Výpadek = bez sledování → lhůta se
 * odhadne z odeslání (ve prospěch zákazníka), žádost kvůli tomu nepadá.
 */
export const attachParcelTracking = async <T extends { id: string }>(
  container: MedusaContainer,
  order: T
): Promise<T & { parcel_tracking: ClaimParcelTracking | null }> => {
  let tracking: ClaimParcelTracking | null = null
  try {
    const service = container.resolve<ParcelTrackingModuleService>(
      PARCEL_TRACKING_MODULE
    )
    const rows = (await service.listParcelTrackings(
      { order_id: order.id } as never,
      { take: 1 } as never
    )) as any[]
    tracking = rows[0]
      ? { delivered_at: rows[0].delivered_at ?? null, done: Boolean(rows[0].done) }
      : null
  } catch {
    tracking = null
  }
  return Object.assign(order, { parcel_tracking: tracking })
}

export const loadClaimOrder = async (
  container: MedusaContainer,
  orderId: string
): Promise<(ClaimOrder & Record<string, any>) | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: CLAIM_ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = (orders[0] as any) ?? null
  return order ? attachParcelTracking(container, order) : null
}

/**
 * Čistá zakázka: VŠE na míru → bez práva odstoupit (§1837 písm. d). Balné a
 * doběrečné nejsou zboží — jinak by jediný řádek balného z čisté zakázky
 * udělal „smíšenou" objednávku a otevřel odstoupení.
 */
export const allMadeToOrder = (order: ClaimOrder): boolean => {
  const items = (order.items ?? []).filter((item) => !isServiceLine(item as any))
  return items.length > 0 && items.every((item) => isMadeToOrderItem(item))
}

/**
 * Konec 14denní lhůty pro odstoupení — od PŘEVZETÍ zboží, ne od odeslání
 * (pravidla a rezerva u neznámého převzetí: `withdrawal.ts`). Null = lhůta
 * ještě neběží (neodesláno, zásilka na cestě) → odstoupit lze.
 */
export const withdrawalDeadlineFor = (order: ClaimOrder): Date | null =>
  withdrawalTimingFor(order).deadline

/** Objednávka je zrušená — odstoupit už není od čeho. */
export const isOrderCancelled = (order: ClaimOrder): boolean =>
  order.status === "canceled" || order.status === "cancelled"

export const WITHDRAW_BLOCK_MADE_TO_ORDER =
  "Zboží vyrobené na míru podle vašeho zadání nelze vrátit ani od smlouvy odstoupit (§ 1837 písm. d) občanského zákoníku). Má-li vadu, uplatněte prosím reklamaci, nebo se nám ozvěte."

export const withdrawBlockDeadline = (deadline: Date): string =>
  `14denní lhůta pro odstoupení od smlouvy uplynula ${formatPragueDate(deadline)}. Má-li zboží vadu, uplatněte prosím reklamaci, nebo se nám ozvěte.`

export const WITHDRAW_BLOCK_OPEN_REQUEST =
  "K této objednávce už jedna žádost běží — jakmile ji vyřídíme, bude možné podat další."

export const WITHDRAW_BLOCK_OPEN_WITHDRAWAL =
  "Odstoupení (vrácení zboží) k této objednávce už evidujeme a vyřizujeme ho. Chcete-li odstoupit i od dalšího zboží, napište nám na info@keramickazahrada.cz — e-mail platí stejně."

export const WITHDRAW_BLOCK_CANCELLED =
  "Objednávka je zrušená — od smlouvy už není potřeba odstupovat."

export type WithdrawBlockCode =
  | "made_to_order"
  | "cancelled"
  | "expired"
  | "open_withdrawal"

export type WithdrawalGate = {
  can_withdraw: boolean
  withdrawal_deadline: string | null
  withdraw_block_reason: string | null
  /** Strojový důvod blokace — storefront podle něj volí vysvětlení. */
  withdraw_block_code: WithdrawBlockCode | null
  takeover_at: string | null
  takeover_basis: TakeoverBasis
}

/**
 * `can_withdraw` = není čistá zakázka ∧ objednávka není zrušená ∧ (lhůta
 * neběží ∨ dnes ≤ konec lhůty) ∧ neběží jiné odstoupení / vrácení. Důvod
 * blokace v pořadí závažnosti — zákon před lhůtou, lhůta před frontou.
 *
 * Otevřená REKLAMACE odstoupení neblokuje (`blocksWithdrawal`): tlačítko pro
 * odstoupení musí být dostupné po celou lhůtu (§ 1830a OZ).
 */
export const withdrawalGate = (
  order: ClaimOrder,
  requests: Array<{ status?: string | null; kind?: string | null }>,
  now: Date = new Date()
): WithdrawalGate => {
  const timing = withdrawalTimingFor(order)
  const deadline = timing.deadline
  const base = {
    withdrawal_deadline: deadline ? deadline.toISOString() : null,
    takeover_at: timing.takeover_at ? timing.takeover_at.toISOString() : null,
    takeover_basis: timing.basis,
  }
  const blocked = (code: WithdrawBlockCode, reason: string): WithdrawalGate => ({
    ...base,
    can_withdraw: false,
    withdraw_block_reason: reason,
    withdraw_block_code: code,
  })

  if (allMadeToOrder(order)) {
    return blocked("made_to_order", WITHDRAW_BLOCK_MADE_TO_ORDER)
  }
  if (isOrderCancelled(order)) {
    return blocked("cancelled", WITHDRAW_BLOCK_CANCELLED)
  }
  if (deadline && now.getTime() > deadline.getTime()) {
    return blocked("expired", withdrawBlockDeadline(deadline))
  }
  if (requests.some((request) => blocksWithdrawal(request))) {
    return blocked("open_withdrawal", WITHDRAW_BLOCK_OPEN_WITHDRAWAL)
  }
  return {
    ...base,
    can_withdraw: true,
    withdraw_block_reason: null,
    withdraw_block_code: null,
  }
}

/** Blokuje otevřená žádost podání reklamace / vrácení? (jedna otevřená na objednávku) */
export const hasBlockingClaim = (
  requests: Array<{ status?: string | null; kind?: string | null }>
): boolean => requests.some((request) => blocksNewClaim(request))

const iso = (value: unknown): string | null => {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Veřejný tvar žádosti pro zákazníka (§4, §11.1). `decision_note` jen u
 * zamítnutí — u schválení je to interní poznámka majitelky. `line_items` =
 * vybrané položky (null = celá objednávka), `damage_cause` = „carrier" u
 * poškození přepravou. `submitted_at` = okamžik odeslání (u starších žádostí
 * `created_at`), `channel` = kudy přišla.
 */
export const serializeClaim = (request: any) => ({
  id: request.id,
  kind: request.kind ?? null,
  status: request.status,
  created_at: iso(request.created_at),
  submitted_at: iso(request.submitted_at) ?? iso(request.created_at),
  channel: request.channel ?? null,
  takeover_at: iso(request.takeover_at),
  resolve_by: iso(request.resolve_by),
  requested_resolution: request.requested_resolution ?? null,
  resolution: request.resolution ?? null,
  protocol_url: request.protocol_url ?? null,
  refund_amount: requestRefundedTotal(request) || null,
  refunds: requestRefunds(request),
  goods_received_at: iso(request.goods_received_at),
  goods_tracking: request.goods_tracking ?? null,
  resolved_at: iso(request.resolved_at),
  decision_note:
    request.status === "rejected" ? (request.decision_note ?? null) : null,
  reason: request.reason,
  line_items: Array.isArray(request.line_items) && request.line_items.length
    ? claimLineItemsOf(request.line_items)
    : null,
  damage_cause: isDamageCause(request.damage_cause) ? request.damage_cause : null,
  refund_account: storedRefundAccount(request.refund_account)?.display ?? null,
})

export const listOrderClaims = async (
  container: MedusaContainer,
  orderId: string
): Promise<any[]> => {
  const service = container.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )
  const requests = (await service.listReturnRequests(
    { order_id: orderId } as never,
    { order: { created_at: "DESC" } } as never
  )) as any[]
  return requests
}

/** Jméno zákazníka z objednávky, nebo null (žádné „Vážený zákazníku"). */
export const orderCustomerName = (order: any): string | null => {
  const sources = [order?.customer, order?.shipping_address, order?.billing_address]
  for (const source of sources) {
    const name = [source?.first_name, source?.last_name]
      .filter((part) => typeof part === "string" && part.trim())
      .join(" ")
      .trim()
    if (name) return name
  }
  return null
}

/**
 * Jak se peníze vrátí: dobírka / platba na místě → převod na účet; kartou
 * zaplacené → zpět na kartu; nic zachyceno → není co vracet.
 */
export const refundMethodKindOf = (order: ClaimOrder): RefundMethodKind => {
  if (refundAccountNeeded(order as any)) return "account"
  return capturedTotal(order as any) > MONEY_EPSILON ? "card" : "none"
}

/**
 * Předvyplněný formulář odstoupení (`withdrawal` v GET) — vše, co stránka
 * `/order/:id/odstoupeni` ukáže v kroku 1 a zopakuje v kontrole (krok 2).
 */
export const buildWithdrawalContext = (
  order: ClaimOrder & Record<string, any>,
  returnAddress: string
) => {
  const timing = withdrawalTimingFor(order)
  const refundMethod = refundMethodKindOf(order)
  return {
    order_display_id: String(order.display_id ?? ""),
    currency_code: String(order.currency_code || "czk").toLowerCase(),
    order_date: iso(order.created_at),
    order_date_text: formatPragueDate(order.created_at),
    customer_name: orderCustomerName(order),
    email: order.email ?? null,
    goods_shipped: goodsShipped(order),
    takeover_at: timing.takeover_at ? timing.takeover_at.toISOString() : null,
    takeover_basis: timing.basis,
    takeover_text: takeoverTextFor(timing),
    shipped_at: timing.shipped_at ? timing.shipped_at.toISOString() : null,
    deadline: timing.deadline ? timing.deadline.toISOString() : null,
    deadline_text: timing.deadline ? formatPragueDateTime(timing.deadline) : null,
    items: withdrawalItemsOf(order as any),
    refund_method: refundMethod,
    refund_method_text: refundMethodTextFor(refundMethod),
    return_address: returnAddress,
  }
}

/** Celá odpověď `GET /store/orders/:id/claims`. */
export const buildClaimsContext = async (
  container: MedusaContainer,
  order: ClaimOrder & Record<string, any>,
  requests?: any[]
) => {
  const rows = requests ?? (await listOrderClaims(container, order.id))
  const settings = await getMerchantSettings(container).catch(() => null)
  const gate = withdrawalGate(order, rows)
  const byId = new Map(
    (order.items ?? [])
      .filter((item) => typeof item?.id === "string")
      .map((item) => [item.id as string, item])
  )

  return {
    ...gate,
    return_address:
      settings?.return_address || "Keramická zahrada\nPutim 229\n397 01 Písek",
    return_instructions: settings?.return_instructions?.trim() || null,
    all_made_to_order: allMadeToOrder(order),
    // Pro výběr položek ve formuláři (§11.1) — ceny po slevě, s DPH; zakázka
    // označená, ať ji vrácení zboží nenabídne (§1837 písm. d).
    order_items: orderItemsForClaims(order).map((item) => ({
      ...item,
      is_made_to_order: isMadeToOrderItem(byId.get(item.id)),
    })),
    // Neplaceno kartou → peníze jdou převodem, formulář chce číslo účtu.
    refund_account_needed: refundAccountNeeded(order as any),
    order_status: order.status ?? null,
    withdrawal: buildWithdrawalContext(
      order,
      withdrawalReturnAddress(settings?.return_address)
    ),
    requests: rows.map(serializeClaim),
  }
}
