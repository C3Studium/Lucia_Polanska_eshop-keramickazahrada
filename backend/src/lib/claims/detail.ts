import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  getLastFulfillmentStatus,
  getLastPaymentStatus,
} from "@medusajs/medusa/core-flows"
import { deliveryContext } from "../order-delivery-context"
import { LINE_QUANTITY_FIELDS } from "../order-quantity"
import { retrieveClaim } from "./admin"
import { attachComponents, loadBundleComponentSources } from "./bundle-components"
import { planClaimCase, type ClaimCasePlan, type ClaimFlags } from "./case"
import { isDamageCause } from "./constants"
import { claimFlagsOf } from "./flags"
import { claimLineItemsOf, suggestedRefundAmount } from "./line-items"
import { loadOrderRequests, MONEY_STATE_FIELDS } from "./money"
import { buildClaimOrderItems, type ClaimOrderItemDetail } from "./order-items"
import {
  priceRefundLines,
  refundAllLines,
  shippingRefundAllowedFor,
  shippingStateOf,
  type ShippingRefundState,
} from "./refund-lines"
import { formatIban, refundAccountNeeded, storedRefundAccount } from "./refund-account"
import {
  commissionPaidRemaining,
  loadClaimProduction,
  type ClaimProduction,
} from "./production"
import {
  moneyState,
  refundHistoryOf,
  requestRefunds,
  toNumber,
  type MoneyState,
  type RefundEntry,
  type RefundLine,
} from "./refund-rules"

/**
 * Detail pro STRÁNKU žádosti — `GET /admin/return-requests/:id/detail`
 * (docs/reklamace-a-zruseni.md §12.2). Jedna odpověď s objednávkou,
 * položkami, penězi, zakázkou, vlajkami a průběhem, ať stránka nedělá pět
 * dotazů a nehádá, co smí.
 *
 * ## Proč se objednávka čte přes `query.graph` a stavy dopočítávají
 *
 * `payment_status` a `fulfillment_status` na entitě `order` neexistují —
 * počítá je nativní list workflow z kolekcí plateb a fulfillmentů
 * (`getLastPaymentStatus` / `getLastFulfillmentStatus`). Tady se volají ty
 * samé funkce nad týmiž poli, takže čísla pro refundaci (`moneyState`,
 * BigNumber tvary) i stavy pocházejí z jediného dotazu.
 */

/**
 * Pole objednávky pro detail žádosti: peníze (`MONEY_STATE_FIELDS`), položky
 * s množstvím přes detail (lib/order-quantity) a `total` (bez něj modul
 * objednávek nespustí `decorateCartTotals` a řádky nemají `total` po slevě),
 * značka zakázky na produktu, doprava (osobní odběr), kolekce plateb pro
 * stav platby a otevřenou kolekci doplatku, fulfillmenty pro stav odeslání.
 */
export const CLAIM_DETAIL_ORDER_FIELDS = [
  ...MONEY_STATE_FIELDS,
  "status",
  "email",
  "created_at",
  "canceled_at",
  "total",
  "subtotal",
  "shipping_total",
  // Ceny komponent balíčku (§13.5) v regionu/měně objednávky.
  "region_id",
  "items.*",
  ...LINE_QUANTITY_FIELDS,
  "items.detail.raw_fulfilled_quantity",
  "items.product.metadata",
  // Zakázka i podle kategorie Zakázková výroba (made-to-order.ts, 14. 10. 2026).
  "items.product.categories.handle",
  "customer.first_name",
  "customer.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "billing_address.first_name",
  "billing_address.last_name",
  // `shipping_total` se počítá z dopravních metod — bez `shipping_methods.*`
  // (+ daně, úpravy) přijde 0 a košík poštovné nenabídne (změřeno 11. 10. 2026
  // na #36: poštovné 90 Kč, detail hlásil 0). Stejně jako MONEY_ORDER_FIELDS.
  "shipping_methods.*",
  "shipping_methods.tax_lines.*",
  "shipping_methods.adjustments.*",
  "shipping_methods.shipping_option.provider_id",
  "payment_collections.id",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.refunded_amount",
  "payment_collections.metadata",
  "fulfillments.id",
  "fulfillments.packed_at",
  "fulfillments.delivered_at",
]

export const loadClaimDetailOrder = async (
  scope: MedusaContainer,
  orderId: string
): Promise<any | null> => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: CLAIM_DETAIL_ORDER_FIELDS,
    filters: { id: orderId },
  })
  return (orders[0] as any) ?? null
}

export const customerNameOf = (order: any, fallback?: string | null): string | null => {
  const sources = [order?.customer, order?.shipping_address, order?.billing_address]
  for (const source of sources) {
    const name = [source?.first_name, source?.last_name]
      .filter((part) => typeof part === "string" && part.trim())
      .join(" ")
      .trim()
    if (name) return name
  }
  return fallback ?? null
}

const paymentStatusOf = (order: any): string | null => {
  try {
    return getLastPaymentStatus({
      currency_code: order.currency_code,
      payment_collections: order.payment_collections ?? [],
    } as any) as string
  } catch {
    return null
  }
}

const fulfillmentStatusOf = (order: any): string | null => {
  try {
    return getLastFulfillmentStatus({
      fulfillments: order.fulfillments ?? [],
      items: order.items ?? [],
    } as any) as string
  } catch {
    return null
  }
}

export type ClaimMoneyRefund = RefundEntry & { request_id: string | null }

/**
 * Všechny refundace objednávky pro sekci „Platby": z modulu (všechny žádosti
 * k objednávce, s položkami a rozsahem) i mimo něj (`refund_history` bez
 * vazby na žádost — „Vrátit rozdíl"). Seřazené podle času.
 */
export const orderRefundsOf = (order: any, requests: any[]): ClaimMoneyRefund[] => {
  const fromRequests = requests.flatMap((request) =>
    requestRefunds(request).map((refund) => ({ ...refund, request_id: request.id as string }))
  )
  const fromHistory: ClaimMoneyRefund[] = refundHistoryOf(order)
    .filter((entry) => !entry.return_request_id)
    .map((entry) => ({
      amount: toNumber(entry.amount),
      method: entry.method === "comgate" ? "comgate" : "manual",
      at: entry.refunded_at ?? "",
      note: entry.reason ?? null,
      scope: null,
      items: null,
      request_id: null,
    }))
  return [...fromRequests, ...fromHistory].sort((a, b) =>
    String(a.at).localeCompare(String(b.at))
  )
}

export type ClaimDetail = ClaimCasePlan & {
  request: any
  order: {
    id: string
    display_id: number | string | null
    status: string | null
    email: string | null
    customer_name: string | null
    currency_code: string
    total: number
    subtotal: number
    shipping_total: number
    created_at: unknown
    canceled_at: unknown
    payment_status: string | null
    fulfillment_status: string | null
    shipping_method: { name: string | null; is_pickup: boolean } | null
  }
  items: ClaimOrderItemDetail[]
  money: MoneyState & { refunds: ClaimMoneyRefund[] }
  /** §13.2 — poštovné: celkem / už vráceno / lze vrátit (jednou). */
  shipping: ShippingRefundState
  /**
   * Náhled výslovného „Vrátit vše" (`refundAllLines` + ocenění) — přesně to,
   * co pošle `scope: "all"`: u odstoupení / vrácení celá objednávka i
   * s poštovným, u reklamace jen reklamované výrobky (`products_only`).
   */
  refund_all: {
    amount: number
    lines: RefundLine[]
    products_only: boolean
    problem: string | null
  }
  /**
   * Účet pro vrácení převodem (`refund-account.ts`): `needed` = objednávka
   * nebyla placená kartou, peníze posílá majitelka sama.
   */
  refund_account: { needed: boolean; display: string | null; iban: string | null }
  production: ClaimProduction | null
  flags: ClaimFlags
}

export const buildClaimDetail = async (
  scope: MedusaContainer,
  requestId: string
): Promise<ClaimDetail> => {
  const request = await retrieveClaim(scope, requestId)
  const order = await loadClaimDetailOrder(scope, request.order_id)
  if (!order) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka k této žádosti nebyla nalezena."
    )
  }
  const requests = await loadOrderRequests(scope, request.order_id)
  const state = moneyState(order, requests)
  const production = await loadClaimProduction(scope, order.id)
  const flags = claimFlagsOf(order, state, Boolean(production))
  const baseItems = buildClaimOrderItems({
    order,
    requests,
    request,
    commissionPaidRemaining: production ? commissionPaidRemaining(production.block) : null,
  })
  // Balíček po komponentách (§13.5) — jen když objednávka nějaký má; dotaz
  // na modul balíčků se jinak nespouští.
  const items = attachComponents(
    baseItems,
    await loadBundleComponentSources(scope, order, baseItems),
    requests
  )
  // Poštovné jen u odstoupení / vrácení — reklamace vrací cenu výrobků.
  const shipping = shippingStateOf(order, requests, {
    allowRefund: shippingRefundAllowedFor(request.kind),
  })
  // Stejné řádky a ocenění jako `refundClaim` se `scope: "all"` (bez komponent).
  const refundAll = (() => {
    const productsOnly = !shipping.allowed
    const raw = refundAllLines(baseItems, shipping, state.remaining)
    if (!raw.length) {
      return { amount: 0, lines: [] as RefundLine[], products_only: productsOnly, problem: null }
    }
    const priced = priceRefundLines({
      items: baseItems,
      shipping,
      lines: raw,
      remaining: state.remaining,
      clampToRemaining: true,
    })
    return priced.ok === false
      ? { amount: 0, lines: [] as RefundLine[], products_only: productsOnly, problem: priced.message }
      : { amount: priced.amount, lines: priced.lines, products_only: productsOnly, problem: null }
  })()
  const account = storedRefundAccount(request.refund_account)
  const plan = planClaimCase({
    request,
    flags,
    money: state,
    production: production?.block ?? null,
    order: { status: order.status, canceled_at: order.canceled_at },
    items,
  })

  const currency = String(order.currency_code ?? "czk").toLowerCase()
  const shippingMethod = ((order.shipping_methods ?? []) as any[])[0] ?? null
  const lineItems = claimLineItemsOf(request.line_items)

  return {
    request: {
      ...request,
      line_items: lineItems.length ? lineItems : null,
      damage_cause: isDamageCause(request.damage_cause) ? request.damage_cause : null,
      refunds: requestRefunds(request),
      // Stejná dopočítaná pole jako řádek seznamu (`enrichWithMoney`), ať
      // stránka a seznam sdílejí typ.
      currency_code: currency,
      captured_total: state.captured,
      refunded_total: state.refunded,
      remaining: state.remaining,
      suggested_amount: suggestedRefundAmount(state.remaining, request.line_items),
      goods_shipped: flags.goods_shipped,
    },
    order: {
      id: order.id,
      display_id: order.display_id ?? null,
      status: order.status ?? null,
      email: order.email ?? null,
      customer_name: customerNameOf(order, request.customer_name),
      currency_code: currency,
      total: toNumber(order.total),
      subtotal: toNumber(order.subtotal),
      shipping_total: toNumber(order.shipping_total),
      created_at: order.created_at ?? null,
      canceled_at: order.canceled_at ?? null,
      payment_status: paymentStatusOf(order),
      fulfillment_status: fulfillmentStatusOf(order),
      shipping_method: shippingMethod
        ? {
            name: shippingMethod.name ?? null,
            is_pickup: deliveryContext(order).method === "pickup",
          }
        : null,
    },
    items,
    money: { ...state, refunds: orderRefundsOf(order, requests) },
    shipping,
    refund_all: refundAll,
    refund_account: {
      needed: refundAccountNeeded(order as any),
      display: account?.display ?? null,
      iban: account ? formatIban(account.iban) : null,
    },
    production: production?.block ?? null,
    flags,
    ...plan,
  }
}
