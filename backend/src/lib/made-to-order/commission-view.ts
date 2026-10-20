import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { goodsShipped } from "../claims/money"
import { productionBlockOf, commissionPaidRemaining } from "../claims/production"
import { toNumber } from "../claims/refund-rules"
import { isMadeToOrderItem } from "../claims/made-to-order"
import { LINE_QUANTITY_FIELDS, lineQuantityOf } from "../order-quantity"
import { isServiceLine } from "../packaging-lines"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"
import {
  cancellationEligibility,
  cancellationPlan,
  type CancellationPhase,
} from "./cancellation"
import { commissionLineOf, commissionVariantSuffix } from "./commission-line"
import { commissionMoney, sumCommissionMoney, type CommissionTotals } from "./commission-money"
import { contractDepositAmountOf } from "./contract-deposit"
import { commissionRefundablePaid } from "./customer-cancel"
import { listCommissionsOfOrder, paymentRequestsByCommission } from "./orders-of"

/**
 * Pohled zákazníka na JEDNU zakázku objednávky (LEGAL_AUDIT.md § 0c, Z-A) —
 * tvar, který vrací `GET /store/made-to-order/:orderId/balance` v
 * `commissions[]` a ze kterého storefront kreslí kartu položky: stav, záloha,
 * doplatek, zrušení, PDF. Jedno místo, ať účet, potvrzení objednávky i
 * `progress` říkají stejná čísla.
 */
export type CommissionView = {
  production_order_id: string
  line_item_id: string | null
  title: string | null
  variant_title: string | null
  thumbnail: string | null
  quantity: number
  stage: string
  currency_code: string
  /** Cena samotné položky (bez dopravy/balného/ostatního zboží). */
  item_total: number
  /** Smluvní záloha (Z2/Z5) — nevratná část po zahájení výroby. */
  deposit_percentage: number
  deposit_amount: number
  /** Zaplaceno za položku (záloha / doplatek) a co za ni zbývá. */
  deposit_paid: number
  balance_paid: number
  outstanding: number
  /** Podepsaný odkaz na doplatek TÉTO zakázky; null, když není co platit. */
  pay_url: string | null
  production_start_notified_at: string | null
  estimated_completion_at: string | null
  production_time_max_days: number | null
  cancelled_by: string | null
  cancellation_phase: string | null
  cancellation_refund_amount: number | null
  cancelled_at: string | null
  confirmation_pdf_url: string | null
  confirmation_sent_at: string | null
  can_cancel: boolean
  blocked_reason: string | null
  /** Co by se stalo, kdyby zákazník zrušil TEĎ (Z4/Z5) — stejný výpočet jako skutečné zrušení. */
  cancellation_preview: {
    phase: CancellationPhase
    paid_total: number
    refund_amount: number
    deposit_kept: number
  }
}

export type CommissionViewsResult = {
  order: any
  commissions: CommissionView[]
  totals: CommissionTotals
  /** Surové řádky modulu ve stejném pořadí jako `commissions` — pro volající, kteří potřebují víc. */
  productionOrders: any[]
  requestsByCommission: Map<string, any[]>
}

export const COMMISSION_VIEW_ORDER_FIELDS = [
  "id",
  "display_id",
  "currency_code",
  "status",
  "items.id",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.thumbnail",
  "items.product_id",
  "items.variant_id",
  "items.total",
  "items.metadata",
  "items.product.metadata",
  "items.product.categories.handle",
  ...LINE_QUANTITY_FIELDS,
  "fulfillments.shipped_at",
  "fulfillments.canceled_at",
]

const iso = (value: unknown): string | null => {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * `production_time_max_days` zakázky: přebití provedení, jinak profil produktu
 * jejího řádku. Null, když se nedá zjistit — nic se nevymýšlí.
 */
const productionTimeMaxDaysOf = async (
  madeToOrder: MadeToOrderModuleService,
  line: { product_id?: string | null; variant_id?: string | null } | null
): Promise<number | null> => {
  if (!line?.product_id) return null
  try {
    const [overrides, profiles] = await Promise.all([
      line.variant_id
        ? madeToOrder.listVariantProductionProfiles({ variant_id: line.variant_id } as never)
        : Promise.resolve([] as any[]),
      madeToOrder.listProductProductionProfiles({ product_id: line.product_id } as never),
    ])
    const days = Number(
      (overrides as any[])[0]?.production_time_max_days_override ??
        (profiles as any[])[0]?.production_time_max_days
    )
    return Number.isFinite(days) && days > 0 ? Math.round(days) : null
  } catch {
    return null
  }
}

export const buildCommissionViews = async (
  container: MedusaContainer,
  orderId: string,
  options: {
    /** Odkaz na doplatek zakázky — volající ho umí složit (env / host requestu). */
    payUrlFor: (productionOrderId: string) => string | null
  }
): Promise<CommissionViewsResult | null> => {
  const madeToOrder = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const productionOrders = await listCommissionsOfOrder(container, orderId)
  if (!productionOrders.length) return null

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: COMMISSION_VIEW_ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = (orders[0] as any) ?? { id: orderId, items: [] }
  const requestsByCommission = await paymentRequestsByCommission(container, productionOrders)
  const shipped = goodsShipped(order)
  const goods = ((order.items ?? []) as any[]).filter((item) => item && !isServiceLine(item))

  const commissions: CommissionView[] = []
  for (const productionOrder of productionOrders) {
    const requests = requestsByCommission.get(productionOrder.id) ?? []
    const money = commissionMoney(productionOrder, requests)
    const block = productionBlockOf(productionOrder, requests)
    const line = commissionLineOf(order, productionOrder)
    const lineItemId: string | null = productionOrder.line_item_id ?? null
    const otherGoods = lineItemId
      ? goods.filter((item) => item.id !== lineItemId)
      : goods.filter((item) => !isMadeToOrderItem(item))
    const eligibility = cancellationEligibility({ stage: block.stage, goodsShipped: shipped })
    const paidTotal = commissionRefundablePaid({
      paidRemaining: commissionPaidRemaining(block),
      extrasTotal: money.extras_total,
      extrasOutstanding: money.extras_outstanding,
      lastItemInOrder: otherGoods.length === 0,
    })
    const plan = cancellationPlan({
      productionStartNotifiedAt: productionOrder.production_start_notified_at,
      paidTotal,
      depositContract: block.deposit_contract,
      cancelledBy: "customer",
    })
    const canPay =
      money.outstanding > 0.005 && !["cancelled", "completed"].includes(String(productionOrder.stage))

    commissions.push({
      production_order_id: productionOrder.id,
      line_item_id: lineItemId,
      title:
        (typeof productionOrder.line_title === "string" && productionOrder.line_title.trim()) ||
        (line?.product_title as string) ||
        (line?.title as string) ||
        null,
      variant_title: commissionVariantSuffix(line?.variant_title) ? String(line?.variant_title) : null,
      thumbnail: (line?.thumbnail as string) || null,
      quantity: toNumber(productionOrder.line_quantity) || (line ? lineQuantityOf(line as any) : 0) || 1,
      stage: String(productionOrder.stage),
      currency_code: String(productionOrder.currency_code || order.currency_code || "czk"),
      item_total: money.item_total,
      deposit_percentage: toNumber(productionOrder.deposit_percentage),
      deposit_amount: contractDepositAmountOf(productionOrder),
      deposit_paid: money.deposit_paid,
      balance_paid: money.balance_paid,
      // Doplatek zakázky nesoucí objednávku zahrnuje i dopravu/balné — to je
      // částka, kterou zákazník na jejím odkazu zaplatí.
      outstanding: money.outstanding,
      pay_url: canPay ? options.payUrlFor(productionOrder.id) : null,
      production_start_notified_at: iso(productionOrder.production_start_notified_at),
      estimated_completion_at: iso(productionOrder.estimated_completion_at),
      production_time_max_days: await productionTimeMaxDaysOf(madeToOrder, line),
      cancelled_by: productionOrder.cancelled_by ?? null,
      cancellation_phase: productionOrder.cancellation_phase ?? null,
      cancellation_refund_amount: block.cancellation_refund_amount,
      cancelled_at: iso(productionOrder.cancelled_at),
      confirmation_pdf_url: productionOrder.confirmation_pdf_url ?? null,
      confirmation_sent_at: iso(productionOrder.confirmation_sent_at),
      can_cancel: eligibility.can_cancel,
      blocked_reason: eligibility.blocked_reason,
      cancellation_preview: {
        phase: plan.phase,
        paid_total: paidTotal,
        refund_amount: plan.refund_amount,
        deposit_kept: plan.deposit_kept,
      },
    })
  }

  return {
    order,
    commissions,
    totals: sumCommissionMoney(
      productionOrders.map((productionOrder) =>
        commissionMoney(productionOrder, requestsByCommission.get(productionOrder.id) ?? [])
      )
    ),
    productionOrders,
    requestsByCommission,
  }
}
