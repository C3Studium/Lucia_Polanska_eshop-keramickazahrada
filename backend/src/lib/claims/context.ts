import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMerchantSettings } from "../merchant-settings"
import { RETURN_REQUEST_MODULE } from "../../modules/return-request"
import type ReturnRequestModuleService from "../../modules/return-request/service"
import { isOpenStatus, WITHDRAWAL_DAYS } from "./constants"
import { requestRefunds, requestRefundedTotal } from "./refund-rules"

/**
 * Kontext „Reklamace a vrácení" pro zákazníka (docs/reklamace-a-zruseni.md §4,
 * `GET /store/orders/:id/claims`) a sdílené výpočty, které z něj potřebuje i
 * intake (§1837, 14denní lhůta, jedna otevřená žádost).
 *
 * Gating se počítá NA SERVERU a storefront ho jen zobrazuje — pravidlo, které
 * hlídá jen prohlížeč, přestane platit při prvním ručním requestu.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export type ClaimOrderItem = {
  id?: string
  metadata?: Record<string, unknown> | null
  product?: { metadata?: Record<string, unknown> | null } | null
}

export type ClaimOrderFulfillment = {
  shipped_at?: string | Date | null
  canceled_at?: string | Date | null
}

export type ClaimOrder = {
  id: string
  display_id?: number | string
  email?: string | null
  items?: ClaimOrderItem[] | null
  fulfillments?: ClaimOrderFulfillment[] | null
}

/** Pole objednávky, která kontext i intake potřebují — jeden seznam pro obě routy. */
export const CLAIM_ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "created_at",
  "currency_code",
  "customer.first_name",
  "customer.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "billing_address.first_name",
  "billing_address.last_name",
  "items.id",
  "items.title",
  "items.product_title",
  "items.quantity",
  "items.metadata",
  "items.product.metadata",
  "fulfillments.id",
  "fulfillments.shipped_at",
  "fulfillments.canceled_at",
]

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
  return (orders[0] as any) ?? null
}

/**
 * Zakázka na míru = položka označená `made_to_order` (na řádku objednávky, nebo
 * na produktu). Stejná detekce jako `guest-refund` a storefront.
 */
export const isMadeToOrderItem = (item: ClaimOrderItem | null | undefined): boolean =>
  Boolean((item?.metadata as any)?.made_to_order) ||
  Boolean((item?.product?.metadata as any)?.made_to_order)

/** Čistá zakázka: VŠE na míru → bez práva odstoupit (§1837 písm. d). */
export const allMadeToOrder = (order: ClaimOrder): boolean => {
  const items = order.items ?? []
  return items.length > 0 && items.every((item) => isMadeToOrderItem(item))
}

/**
 * Lhůta 14 dnů pro odstoupení: od převzetí zboží. Převzetí neznáme přesně, bere
 * se nejpozdější odeslání (`max(fulfillments.shipped_at)`) — ve prospěch
 * zákazníka. Bez odeslané zásilky lhůta neběží (null → odstoupit lze).
 */
export const withdrawalDeadlineFor = (order: ClaimOrder): Date | null => {
  const shipped = (order.fulfillments ?? [])
    .filter((fulfillment) => fulfillment?.shipped_at && !fulfillment?.canceled_at)
    .map((fulfillment) => new Date(fulfillment.shipped_at as string).getTime())
    .filter((time) => Number.isFinite(time))
  if (!shipped.length) {
    return null
  }
  return new Date(Math.max(...shipped) + WITHDRAWAL_DAYS * DAY_MS)
}

const fmtDate = (value: Date) =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(value)

export const WITHDRAW_BLOCK_MADE_TO_ORDER =
  "Zboží vyrobené na míru nelze vrátit ani od smlouvy odstoupit (§ 1837 písm. d) občanského zákoníku). Má-li vadu, uplatněte prosím reklamaci, nebo se nám ozvěte."

export const withdrawBlockDeadline = (deadline: Date): string =>
  `14denní lhůta pro odstoupení od smlouvy uplynula ${fmtDate(deadline)}. Má-li zboží vadu, uplatněte prosím reklamaci, nebo se nám ozvěte.`

export const WITHDRAW_BLOCK_OPEN_REQUEST =
  "K této objednávce už jedna žádost běží — jakmile ji vyřídíme, bude možné podat další."

export type WithdrawalGate = {
  can_withdraw: boolean
  withdrawal_deadline: string | null
  withdraw_block_reason: string | null
}

/**
 * `can_withdraw` = není čistá zakázka ∧ (neodesláno ∨ dnes ≤ lhůta) ∧ žádná
 * otevřená žádost. Důvod blokace v pořadí závažnosti — zákon před lhůtou,
 * lhůta před frontou.
 */
export const withdrawalGate = (
  order: ClaimOrder,
  requests: Array<{ status?: string | null }>,
  now: Date = new Date()
): WithdrawalGate => {
  const deadline = withdrawalDeadlineFor(order)
  const iso = deadline ? deadline.toISOString() : null

  if (allMadeToOrder(order)) {
    return {
      can_withdraw: false,
      withdrawal_deadline: iso,
      withdraw_block_reason: WITHDRAW_BLOCK_MADE_TO_ORDER,
    }
  }
  if (deadline && now.getTime() > deadline.getTime()) {
    return {
      can_withdraw: false,
      withdrawal_deadline: iso,
      withdraw_block_reason: withdrawBlockDeadline(deadline),
    }
  }
  if (requests.some((request) => isOpenStatus(request.status))) {
    return {
      can_withdraw: false,
      withdrawal_deadline: iso,
      withdraw_block_reason: WITHDRAW_BLOCK_OPEN_REQUEST,
    }
  }
  return { can_withdraw: true, withdrawal_deadline: iso, withdraw_block_reason: null }
}

const iso = (value: unknown): string | null => {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Veřejný tvar žádosti pro zákazníka (§4). `decision_note` jen u zamítnutí —
 * u schválení je to interní poznámka majitelky.
 */
export const serializeClaim = (request: any) => ({
  id: request.id,
  kind: request.kind ?? null,
  status: request.status,
  created_at: iso(request.created_at),
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

/** Celá odpověď `GET /store/orders/:id/claims`. */
export const buildClaimsContext = async (
  container: MedusaContainer,
  order: ClaimOrder,
  requests?: any[]
) => {
  const rows = requests ?? (await listOrderClaims(container, order.id))
  const settings = await getMerchantSettings(container).catch(() => null)
  const gate = withdrawalGate(order, rows)

  return {
    ...gate,
    return_address:
      settings?.return_address || "Keramická zahrada\nPutim 229\n397 01 Písek",
    return_instructions: settings?.return_instructions?.trim() || null,
    all_made_to_order: allMadeToOrder(order),
    requests: rows.map(serializeClaim),
  }
}
