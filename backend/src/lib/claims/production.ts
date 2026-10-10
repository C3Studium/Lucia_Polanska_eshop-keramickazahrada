import type { MedusaContainer } from "@medusajs/framework/types"
import { outstandingFor } from "../balance-payment"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"
import { MONEY_EPSILON, round2, toNumber } from "./refund-rules"

/**
 * Blok „Zakázka" pro stránku žádosti (docs/reklamace-a-zruseni.md §12.2) a
 * pro refundaci zálohy (§12.3 `scope: "deposit"`).
 *
 * Záloha i doplatek jsou v modulu zakázek dvě ŽÁDOSTI O PLATBU
 * (`production_payment_request`, typ `deposit` / `balance`) — „zaplacená
 * záloha" = součet zaplacených žádostí typu `deposit`, ne odhad z procenta.
 * `outstanding` jde přes `outstandingFor` (jediná definice dluhu — brána
 * odeslání, výzva k doplacení i tenhle blok říkají totéž).
 */

export type ClaimProduction = {
  id: string
  stage: string
  agreed_total: number
  surcharge: number
  deposit_paid: number
  balance_paid: number
  outstanding: number
  /** Vráceno ze zálohy přes modul (§12.3). */
  deposit_refunded: number
  deposit_refunded_at: string | null
  cancelled_at: string | null
  /** Stav poslední žádosti o doplatek (`pending`/`sent`/`paid`/…), null = žádná. */
  balance_request_status: string | null
}

const iso = (value: unknown): string | null => {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const timeOf = (value: unknown): number => {
  const date = new Date((value as string) ?? 0)
  const time = date.getTime()
  return Number.isFinite(time) ? time : 0
}

/** ČISTÉ: blok zakázky z řádku `production_order` a jeho žádostí o platbu. */
export const productionBlockOf = (
  productionOrder: any,
  paymentRequests: any[]
): ClaimProduction => {
  const paid = (type: "deposit" | "balance") =>
    round2(
      (paymentRequests ?? [])
        .filter((request) => request?.type === type && request?.status === "paid")
        .reduce((sum, request) => sum + toNumber(request.amount), 0)
    )
  const balanceRequests = (paymentRequests ?? [])
    .filter((request) => request?.type === "balance")
    .sort((a, b) => timeOf(b?.created_at) - timeOf(a?.created_at))

  return {
    id: String(productionOrder.id),
    stage: String(productionOrder.stage ?? ""),
    agreed_total: round2(
      toNumber(productionOrder.agreed_total ?? productionOrder.original_total)
    ),
    surcharge: round2(toNumber(productionOrder.surcharge)),
    deposit_paid: paid("deposit"),
    balance_paid: paid("balance"),
    outstanding: outstandingFor(productionOrder, paymentRequests ?? []),
    deposit_refunded: round2(Math.max(0, toNumber(productionOrder.deposit_refunded))),
    deposit_refunded_at: iso(productionOrder.deposit_refunded_at),
    cancelled_at: iso(productionOrder.cancelled_at),
    balance_request_status: balanceRequests[0]?.status ?? null,
  }
}

/** Kolik ze zálohy se ještě dá vrátit (§12.3 `deposit`): zaplaceno − vráceno. */
export const depositRefundable = (production: ClaimProduction): number =>
  Math.max(0, round2(production.deposit_paid - production.deposit_refunded))

/**
 * Co je za zakázku skutečně zaplaceno a ještě nevráceno — strop
 * `refundable_amount` zakázkové položky (§12.2).
 */
export const commissionPaidRemaining = (production: ClaimProduction): number =>
  Math.max(
    0,
    round2(production.deposit_paid + production.balance_paid - production.deposit_refunded)
  )

export const depositFullyRefunded = (production: ClaimProduction): boolean =>
  depositRefundable(production) <= MONEY_EPSILON

export type LoadedClaimProduction = {
  productionOrder: any
  paymentRequests: any[]
  block: ClaimProduction
}

/** Zakázka k objednávce (modul made-to-order), nebo null u běžné objednávky. */
export const loadClaimProduction = async (
  scope: MedusaContainer,
  orderId: string
): Promise<LoadedClaimProduction | null> => {
  const madeToOrder = scope.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const [productionOrder] = (await madeToOrder.listProductionOrders({
    order_id: orderId,
  } as never)) as any[]
  if (!productionOrder) {
    return null
  }
  const paymentRequests = (await madeToOrder.listProductionPaymentRequests({
    production_order_id: productionOrder.id,
  } as never)) as any[]
  return {
    productionOrder,
    paymentRequests,
    block: productionBlockOf(productionOrder, paymentRequests),
  }
}
