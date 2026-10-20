import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { outstandingFor } from "../balance-payment"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"
import { contractDepositAmountOf } from "../made-to-order/contract-deposit"
import { listCommissionsOfOrder } from "../made-to-order/orders-of"
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
  /** Zaplaceno v pokladně (žádost typu `deposit`) — může být i celá cena. */
  deposit_paid: number
  balance_paid: number
  outstanding: number
  /**
   * SMLUVNÍ záloha v penězích (LEGAL_AUDIT.md § 0, Z2/Z5): `deposit_amount`
   * zakázky, u starých zakázek odhad `original_total × deposit_percentage / 100`
   * (sevřeno na 50 %). Po zahájení výroby (Z3) je to NEVRATNÁ část — ne vše,
   * co bylo zaplaceno.
   */
  deposit_contract: number
  deposit_percentage: number
  /** Z3: kdy odešel e-mail „Zakázka je ve výrobě"; null = výroba nezačala. */
  production_start_notified_at: string | null
  /** Vráceno ze zálohy přes modul (§12.3). */
  deposit_refunded: number
  deposit_refunded_at: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancellation_phase: string | null
  cancellation_refund_amount: number | null
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
    deposit_contract: contractDepositAmountOf(productionOrder),
    deposit_percentage: round2(toNumber(productionOrder.deposit_percentage)),
    production_start_notified_at: iso(productionOrder.production_start_notified_at),
    deposit_refunded: round2(Math.max(0, toNumber(productionOrder.deposit_refunded))),
    deposit_refunded_at: iso(productionOrder.deposit_refunded_at),
    cancelled_at: iso(productionOrder.cancelled_at),
    cancelled_by:
      typeof productionOrder.cancelled_by === "string" ? productionOrder.cancelled_by : null,
    cancellation_phase:
      typeof productionOrder.cancellation_phase === "string"
        ? productionOrder.cancellation_phase
        : null,
    cancellation_refund_amount:
      productionOrder.cancellation_refund_amount === null ||
      productionOrder.cancellation_refund_amount === undefined
        ? null
        : round2(toNumber(productionOrder.cancellation_refund_amount)),
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
  /**
   * Všechny zakázky objednávky (od 20. 10. 2026 jedna na položku, § 0c).
   * `aggregate: true` = volající nejmenoval zakázku a objednávka má víc než
   * jednu: `block` je SOUČET peněz přes všechny (strop refundací, stav
   * zálohy), `productionOrder` je první z nich — zápis NA ni by byl omyl,
   * proto ho musí volající u víc zakázek odmítnout (`requireSingleCommission`).
   */
  all: LoadedClaimProduction[]
  aggregate: boolean
}

/** Všechny zakázky objednávky s žádostmi o platbu a blokem; prázdné u běžné objednávky. */
export const loadClaimProductions = async (
  scope: MedusaContainer,
  orderId: string
): Promise<LoadedClaimProduction[]> => {
  const madeToOrder = scope.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const commissions = await listCommissionsOfOrder(scope, orderId)
  if (!commissions.length) return []
  const requests = (await madeToOrder.listProductionPaymentRequests({
    production_order_id: commissions.map((commission) => commission.id),
  } as never)) as any[]
  const loaded: LoadedClaimProduction[] = commissions.map((productionOrder) => {
    const paymentRequests = requests.filter(
      (request) => request?.production_order_id === productionOrder.id
    )
    return {
      productionOrder,
      paymentRequests,
      block: productionBlockOf(productionOrder, paymentRequests),
      all: [],
      aggregate: false,
    }
  })
  for (const item of loaded) item.all = loaded
  return loaded
}

const latestIso = (values: Array<string | null>): string | null =>
  values.filter((value): value is string => Boolean(value)).sort().pop() ?? null

const earliestIso = (values: Array<string | null>): string | null =>
  values.filter((value): value is string => Boolean(value)).sort()[0] ?? null

/**
 * ČISTÉ: součet bloků zakázek jedné objednávky (víc zakázek, volající
 * nejmenoval žádnou). Peníze se sčítají; fáze je `cancelled` jen když jsou
 * zrušené všechny; „zahájení výroby" = nejstarší e-mail Z3 (od něj je aspoň
 * jedna záloha nevratná).
 */
export const aggregateProductionBlocks = (blocks: ClaimProduction[]): ClaimProduction => {
  const sum = (pick: (block: ClaimProduction) => number) =>
    round2(blocks.reduce((acc, block) => acc + pick(block), 0))
  const allCancelled = blocks.length > 0 && blocks.every((block) => block.stage === "cancelled")
  const active = blocks.filter((block) => block.stage !== "cancelled")
  const cancelledBy = [...new Set(blocks.map((block) => block.cancelled_by).filter(Boolean))]
  const phases = [...new Set(blocks.map((block) => block.cancellation_phase).filter(Boolean))]
  const refunds = blocks
    .map((block) => block.cancellation_refund_amount)
    .filter((value): value is number => typeof value === "number")
  return {
    id: blocks.map((block) => block.id).join(","),
    stage: allCancelled ? "cancelled" : (active[0]?.stage ?? blocks[0]?.stage ?? ""),
    agreed_total: sum((block) => block.agreed_total),
    surcharge: sum((block) => block.surcharge),
    deposit_paid: sum((block) => block.deposit_paid),
    balance_paid: sum((block) => block.balance_paid),
    outstanding: sum((block) => block.outstanding),
    deposit_contract: sum((block) => block.deposit_contract),
    deposit_percentage: round2(
      blocks.length ? blocks.reduce((acc, block) => acc + block.deposit_percentage, 0) / blocks.length : 0
    ),
    production_start_notified_at: earliestIso(blocks.map((block) => block.production_start_notified_at)),
    deposit_refunded: sum((block) => block.deposit_refunded),
    deposit_refunded_at: latestIso(blocks.map((block) => block.deposit_refunded_at)),
    cancelled_at: allCancelled ? latestIso(blocks.map((block) => block.cancelled_at)) : null,
    cancelled_by: allCancelled && cancelledBy.length === 1 ? cancelledBy[0] : null,
    cancellation_phase: allCancelled && phases.length === 1 ? phases[0] : null,
    cancellation_refund_amount: allCancelled && refunds.length ? round2(refunds.reduce((a, b) => a + b, 0)) : null,
    balance_request_status:
      blocks.map((block) => block.balance_request_status).find((status) => status && status !== "paid") ??
      blocks[0]?.balance_request_status ??
      null,
  }
}

/**
 * Zakázka k objednávce (modul made-to-order), nebo null u běžné objednávky.
 *
 * `productionOrderId` vybírá jednu z víc zakázek (§ 0c). Bez něj: jediná
 * zakázka → ta; víc zakázek → SOUČET (`aggregate: true`) pro souhrny
 * (detail žádosti, strop refundace položek, vlajky). Zápis na jednu konkrétní
 * zakázku s agregátem nejde — viz `requireSingleCommission`.
 */
export const loadClaimProduction = async (
  scope: MedusaContainer,
  orderId: string,
  productionOrderId?: string | null
): Promise<LoadedClaimProduction | null> => {
  const all = await loadClaimProductions(scope, orderId)
  if (!all.length) {
    return null
  }
  if (productionOrderId) {
    const found = all.find((item) => item.productionOrder.id === productionOrderId)
    if (!found) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Zakázka k této objednávce nebyla nalezena."
      )
    }
    return found
  }
  if (all.length === 1) {
    return all[0]
  }
  return {
    productionOrder: all[0].productionOrder,
    paymentRequests: all.flatMap((item) => item.paymentRequests),
    block: aggregateProductionBlocks(all.map((item) => item.block)),
    all,
    aggregate: true,
  }
}

/**
 * Pro úkony NA JEDNÉ zakázce (vrácení zálohy, zrušení zakázky): agregát přes
 * víc zakázek je chyba volajícího — musí říct, kterou (`production_order_id`).
 */
export const requireSingleCommission = (
  production: LoadedClaimProduction,
  what = "tuto akci"
): LoadedClaimProduction => {
  if (production.aggregate) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Objednávka má víc zakázek — pro ${what} uveďte production_order_id.`
    )
  }
  return production
}

/**
 * Zakázka, které patří žádost v Reklamace a zrušení: podle vybraného řádku
 * objednávky (`line_items[].line_item_id` ↔ `production_order.line_item_id`),
 * jinak jediná zakázka objednávky, jinak agregát.
 */
export const commissionIdFromRequestLines = (
  request: { line_items?: unknown } | null | undefined,
  commissions: Array<{ id: string; line_item_id?: string | null }>
): string | null => {
  const lines = Array.isArray(request?.line_items) ? (request!.line_items as any[]) : []
  const lineIds = new Set(lines.map((line) => String(line?.line_item_id ?? "")).filter(Boolean))
  const matched = commissions.filter(
    (commission) => commission.line_item_id && lineIds.has(commission.line_item_id)
  )
  return matched.length === 1 ? matched[0].id : null
}
