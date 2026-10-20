import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  customerName,
  formatMoney,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../customer-email"
import { notifyMerchant } from "../notify"
import { isServiceLine } from "../packaging-lines"
import { nextProtocolSequence, protocolNumberFor } from "../reklamacni-protokol"
import {
  claimService,
  decisionOutcome,
  protocolRefundsOf,
  refundMethodLabel,
  regenerateProtocol,
} from "../claims/admin"
import {
  COMMISSION_CANCEL_DECISION_NOTE,
  UNPAID_BALANCE_DECISION_NOTE,
} from "../claims/auto-cancel"
import { cancelProductionForClaim } from "../claims/cancel-production-action"
import { CLAIM_CHANNEL_ONLINE, COMMISSION_CANCEL_KIND } from "../claims/constants"
import { loadClaimDetailOrder } from "../claims/detail"
import { realCustomerName } from "../claims/intake"
import { goodsShipped, loadOrderRequests } from "../claims/money"
import {
  commissionPaidRemaining,
  loadClaimProduction,
  requireSingleCommission,
} from "../claims/production"
import { refundClaim } from "../claims/refund-action"
import { MONEY_EPSILON, round2, toNumber } from "../claims/refund-rules"
import { formatPragueDateTime } from "../claims/withdrawal"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"
import {
  cancellationEligibility,
  cancellationPlan,
  type CancellationPlan,
} from "./cancellation"
import { commissionLineOf, commissionTitleOf } from "./commission-line"
import { commissionMoney } from "./commission-money"

/**
 * Zrušení zakázky ZÁKAZNÍKEM (LEGAL_AUDIT.md § 0, Z4/Z5) a kvůli NEZAPLACENÉMU
 * DOPLATKU (Z6) — jedna orchestrace, kterou volá store routa
 * `POST /store/made-to-order/:orderId/cancel` i úloha `watch-production-deadlines`.
 * Rozhodnutí o penězích je čisté v `cancellation.ts`; tady je pořadí kroků.
 *
 * ## Proč přes modul „Reklamace a zrušení"
 *
 * Zásada modulu (docs/reklamace-a-zruseni.md §3): peníze se nikdy nevrací
 * potichu — každé vrácení má žádost, protokol, dobropis a potvrzení. Zrušení
 * zakázky tedy založí žádost druhu `zruseni_zakazky` (server-only, viz
 * `constants.ts`), rovnou ji SCHVÁLÍ a VYŘÍDÍ (vzor `auto-cancel-action`),
 * refund jde přes `refundClaim` (ComGate stejnou cestou / převod, dobropis),
 * a výrobní + nativní strana přes `cancelProductionForClaim` — včetně pojistky,
 * že s ponechanou zálohou se objednávka nativně NERUŠÍ, ale dokončí (§13.6).
 *
 * ## Pořadí
 *
 * 1. Kontroly: zakázka existuje, jde zrušit (fáze, zboží neodešlo), žádná
 *    žádost o zrušení už neběží (idempotence → 409).
 * 2. Plán Z4/Z5: fáze podle e-mailu Z3, vráceno = vše / vše nad zálohu.
 * 3. Žádost `approved` + `resolution: refund` (ať `refundClaim` smí vracet).
 * 4. Refund (jen když je co): selže-li ComGate, žádost zůstává otevřená pro
 *    majitelku, zákazník dostane chybu „ozveme se" — nic se neruší napůl.
 * 5. `deposit_refunded` zakázky = zaplacená záloha − ponechaná část, ať
 *    průběh žádosti ukazuje „Záloha vrácena" / „Záloha ponechána" správně.
 * 6. `cancelProductionForClaim` (keep_deposit podle plánu, záznam
 *    `cancelled_by: "customer"` + fáze + vráceno) — výroba, objednávka, žádost.
 * 7. Žádost vyřízená + protokol jako potvrzení o vyřízení (když ji krok 6
 *    nechal otevřenou — smíšená objednávka).
 * 8. JEDEN e-mail zákazníkovi (`commission-cancelled`), zvonek + e-mail majitelce.
 *
 * E-maily z `refundClaim` a `cancelProductionForClaim` jsou vypnuté
 * (`sendEmail: false`) — zákazník dostane jeden e-mail, ne tři.
 */

export type CustomerCancelTrigger = "customer" | "unpaid_balance"

export type CustomerCancelInput = {
  orderId: string
  /**
   * Která zakázka objednávky se ruší (od 20. 10. 2026 má objednávka zakázek
   * víc — § 0c). Bez ní projde jen objednávka s jedinou zakázkou.
   */
  productionOrderId?: string | null
  /** Důvod od zákazníka (nepovinný). */
  reason?: string | null
  trigger?: CustomerCancelTrigger
}

export type CustomerCancelResult = {
  cancelled: true
  production_order_id: string
  /** Název položky zakázky — storefront ho ukáže v potvrzení zrušení. */
  title: string | null
  phase: CancellationPlan["phase"]
  paid_total: number
  refund_amount: number
  deposit_kept: number
  deposit_amount: number
  deposit_percentage: number
  currency_code: string
  request_id: string
  protocol_url: string | null
  /** `comgate` = stejnou cestou přes bránu, `manual` = převodem, null = nic se nevracelo. */
  refund_method: "comgate" | "manual" | null
  order_cancelled: boolean
  order_completed: boolean
  items_removed: number
  email_sent: boolean
  message: string
}

const DAY_MS = 24 * 60 * 60 * 1000

export const COMMISSION_CANCEL_REASON_CUSTOMER =
  "Zrušení zakázky zákazníkem (obchodní podmínky, čl. Výroba na zakázku)."

export const COMMISSION_CANCEL_REASON_UNPAID =
  "Doplatek nezaplacen do 30 dnů od výzvy ani po připomenutí — zakázka zrušena podle obchodních podmínek (čl. Výroba na zakázku, zrušení po zahájení výroby)."

/**
 * Běží už u objednávky žádost o zrušení TÉTO zakázky (ne zamítnutá /
 * stornovaná)? Žádost nese řádek zakázky v `line_items` (zakázka = položka);
 * stará žádost bez řádků platí pro celou objednávku (legacy).
 */
export const openCommissionCancelRequest = (
  requests: any[],
  lineItemId?: string | null
): any | null =>
  (requests ?? []).find((request) => {
    if (request?.kind !== COMMISSION_CANCEL_KIND) return false
    if (request?.status === "rejected" || request?.status === "cancelled") return false
    const lines = Array.isArray(request?.line_items) ? (request.line_items as any[]) : []
    if (!lines.length || !lineItemId) return true
    return lines.some((line) => line?.line_item_id === lineItemId)
  }) ?? null

/**
 * ČISTÉ: co se zákazníkovi vrací ZA TUTO zakázku. Zakázka nesoucí za objednávku
 * dopravu/balné/běžné zboží (`lib/made-to-order/commission-money`) to vrací
 * jen tehdy, když po zrušení v objednávce nic jiného nezbývá — jinak doprava
 * patří zbylým položkám a běžné zboží se doručí.
 */
export const commissionRefundablePaid = (input: {
  paidRemaining: number
  extrasTotal: number
  extrasOutstanding: number
  lastItemInOrder: boolean
}): number => {
  if (input.lastItemInOrder) return Math.max(0, round2(input.paidRemaining))
  const extrasPaid = Math.max(0, round2(input.extrasTotal - input.extrasOutstanding))
  return Math.max(0, round2(input.paidRemaining - extrasPaid))
}

export const cancelCommissionByCustomer = async (
  container: MedusaContainer,
  input: CustomerCancelInput
): Promise<CustomerCancelResult> => {
  const trigger: CustomerCancelTrigger = input.trigger ?? "customer"
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const madeToOrder = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const service = claimService(container)
  const now = new Date()

  // 1) kontroly ------------------------------------------------------------------
  const loaded = await loadClaimProduction(container, input.orderId, input.productionOrderId)
  if (!loaded) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "K této objednávce není zakázková výroba — není co rušit."
    )
  }
  // Ruší se JEDNA zakázka (položka) — u víc zakázek musí volající říct která.
  const production = requireSingleCommission(loaded, "zrušení zakázky")
  const order = await loadClaimDetailOrder(container, input.orderId)
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }
  const shipped = goodsShipped(order)
  const eligibility = cancellationEligibility({
    stage: production.block.stage,
    goodsShipped: shipped,
  })
  if (!eligibility.can_cancel) {
    throw new MedusaError(
      production.block.stage === "cancelled"
        ? MedusaError.Types.CONFLICT
        : MedusaError.Types.NOT_ALLOWED,
      eligibility.blocked_reason ?? "Zakázku teď zrušit nejde."
    )
  }
  const lineItemId: string | null = production.productionOrder.line_item_id ?? null
  const existing = await loadOrderRequests(container, order.id)
  if (openCommissionCancelRequest(existing, lineItemId)) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      "Žádost o zrušení zakázky už evidujeme — ozveme se vám, jakmile bude vyřízená."
    )
  }

  // 2) plán Z4/Z5 ----------------------------------------------------------------
  const currency = String(order.currency_code ?? production.productionOrder.currency_code ?? "czk")
  const fmt = (value: number) => formatMoney(value, currency)
  /*
   * Zaplaceno ZA TUTO zakázku: zakázka nesoucí dopravu/balné/běžné zboží za
   * objednávku je vrací jen jako poslední položka objednávky — jinak doprava
   * patří zbylým položkám a běžné zboží se doručí (§ 0c).
   */
  const ownLine = commissionLineOf(order, production.productionOrder)
  const goods = ((order.items ?? []) as any[]).filter((item) => item && !isServiceLine(item))
  const otherGoods = lineItemId
    ? goods.filter((item) => item.id !== lineItemId)
    : goods.filter((item) => !(item.metadata as any)?.made_to_order)
  const money = commissionMoney(production.productionOrder, production.paymentRequests)
  const paidTotal = commissionRefundablePaid({
    paidRemaining: commissionPaidRemaining(production.block),
    extrasTotal: money.extras_total,
    extrasOutstanding: money.extras_outstanding,
    lastItemInOrder: otherGoods.length === 0,
  })
  const plan = cancellationPlan({
    productionStartNotifiedAt: production.block.production_start_notified_at,
    paidTotal,
    depositContract: production.block.deposit_contract,
    cancelledBy: "customer",
  })
  const after = plan.phase === "after_production"
  const decisionNote =
    trigger === "unpaid_balance" ? UNPAID_BALANCE_DECISION_NOTE : COMMISSION_CANCEL_DECISION_NOTE
  const reason =
    trigger === "unpaid_balance"
      ? COMMISSION_CANCEL_REASON_UNPAID
      : (input.reason ?? "").trim() || COMMISSION_CANCEL_REASON_CUSTOMER
  const phaseNote = after
    ? `zrušení po zahájení výroby (e-mail Z3 ${formatPragueDateTime(
        production.block.production_start_notified_at
      )}) — záloha ${fmt(plan.deposit_kept)} se nevrací, nad zálohu vráceno ${fmt(plan.refund_amount)}`
    : `zrušení před zahájením výroby — vráceno vše (${fmt(plan.refund_amount)})`

  // 3) žádost — schválená serverem, refund jako způsob vyřízení -------------------
  const protocolNumber = protocolNumberFor(
    COMMISSION_CANCEL_KIND,
    String(order.display_id),
    now,
    nextProtocolSequence(existing, now)
  )
  const request = await service.createReturnRequests({
    order_id: order.id,
    order_display_id: String(order.display_id),
    email: order.email ?? "",
    customer_name: realCustomerName(order) ?? undefined,
    kind: COMMISSION_CANCEL_KIND,
    // Řádek zakázky = vazba žádosti na JEDNU zakázku objednávky (§ 0c); podle
    // něj „Zrušit zakázku" i vrácení zálohy poznají, které zakázky se žádost týká.
    line_items: lineItemId
      ? [
          {
            line_item_id: lineItemId,
            title: commissionTitleOf(order, production.productionOrder),
            variant_title: ownLine?.variant_title ?? null,
            thumbnail: ownLine?.thumbnail ?? null,
            quantity: toNumber(production.productionOrder.line_quantity) || 1,
            total: money.item_total,
            currency_code: currency,
          },
        ]
      : null,
    // Vrácení do 14 dnů (Z4/Z5) — lhůta, kterou hlídá job vrácení.
    resolve_by: new Date(now.getTime() + 14 * DAY_MS),
    submitted_at: now,
    channel: CLAIM_CHANNEL_ONLINE,
    reason,
    status: "approved",
    resolution: "refund",
    decision_note: decisionNote,
    decided_at: now,
    protocol_number: protocolNumber,
  } as never)

  // 4) peníze -------------------------------------------------------------------
  let refundMethod: "comgate" | "manual" | null = null
  if (plan.refund_amount > MONEY_EPSILON) {
    try {
      const refund = await refundClaim(
        container,
        request.id,
        {
          scope: "all",
          amount: plan.refund_amount,
          // Zboží nikdy neodešlo (kontrola výš) — není na co čekat (§ 1832/4).
          skip_goods_check: true,
          note: phaseNote,
        },
        { sendEmail: false }
      )
      refundMethod = refund.method
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      logger.warn(
        `[zakázka] Refund při zrušení zakázky ${production.block.id} (objednávka ${order.id}) selhal: ${detail}`
      )
      await service
        .updateReturnRequests({
          id: request.id,
          resolution_note: `Automatický refund selhal: ${detail} — vraťte ${fmt(
            plan.refund_amount
          )} ručně v Reklamace a zrušení a zakázku zrušte.`,
        })
        .catch(() => undefined)
      await notifyMerchant(container, {
        key: `mn:mto-cancel-refund-failed:${request.id}`,
        title: `Zrušení zakázky #${order.display_id} — refund ${fmt(plan.refund_amount)} selhal`,
        description: [
          detail,
          `Fáze: ${after ? "po zahájení výroby" : "před zahájením výroby"}; ${phaseNote}.`,
          "Vraťte peníze ručně v Reklamace a zrušení a zakázku zrušte tam („Zrušit zakázku“).",
        ].join("\n"),
        audience: "owner",
        urgent: true,
        email: true,
        resource: { id: order.id, type: "order" },
      }).catch(() => undefined)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Peníze se nepodařilo vrátit automaticky. Žádost o zrušení evidujeme a ozveme se vám — nic dalšího dělat nemusíte."
      )
    }
  }

  // 5) záloha v účetnictví zakázky: zaplacená záloha − ponechaná část ------------
  const depositRefundedNow = Math.max(
    0,
    round2(production.block.deposit_paid - plan.deposit_kept)
  )
  if (depositRefundedNow > production.block.deposit_refunded + MONEY_EPSILON) {
    await madeToOrder
      .updateProductionOrders({
        id: production.productionOrder.id,
        deposit_refunded: depositRefundedNow,
        deposit_refunded_at: now,
      } as never)
      .catch((error) =>
        logger.warn(
          `[zakázka] Vrácenou zálohu se u ${production.block.id} nepodařilo zapsat: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      )
  }

  // 6) výroba + objednávka + žádost ----------------------------------------------
  const cancel = await cancelProductionForClaim(
    container,
    request.id,
    {
      production_order_id: production.productionOrder.id,
      keep_deposit: plan.deposit_kept > MONEY_EPSILON,
      note: phaseNote,
      cancellation: {
        cancelled_by: "customer",
        cancellation_phase: plan.phase,
        cancellation_refund_amount: plan.refund_amount,
      },
    },
    null,
    { sendEmail: false }
  )

  // 7) vyřízeno + protokol (smíšená objednávka ji mohla nechat otevřenou) --------
  let resolved = cancel.return_request
  let protocolUrl: string | null = resolved?.protocol_url ?? null
  if (resolved?.status !== "resolved") {
    resolved = await service.updateReturnRequests({
      id: request.id,
      status: "resolved",
      resolved_at: now,
      resolution: "refund",
      resolution_note: resolved?.resolution_note ?? phaseNote,
    })
    const protocol = await regenerateProtocol(container, resolved, {
      outcome: decisionOutcome(resolved),
      note: resolved.resolution_note ?? phaseNote,
      decidedAt: now,
      confirmation: true,
      refunds: protocolRefundsOf(resolved, currency),
    })
    protocolUrl = protocol.url ?? protocolUrl
  }

  // 8) e-maily --------------------------------------------------------------------
  const title = commissionTitleOf(order, production.productionOrder)
  const emailSent = await sendCustomerEmail(container, {
    template: "commission-cancelled",
    to: order.email,
    key: `mto-cancel:${production.block.id}`,
    orderId: order.id,
    data: {
      customerName: customerName(order),
      orderNumber: orderNumber(order),
      orderLink: orderLink(order),
      productTitle: title,
      phase: plan.phase,
      trigger,
      cancelledAtText: formatPragueDateTime(now),
      productionStartedAtText: production.block.production_start_notified_at
        ? formatPragueDateTime(production.block.production_start_notified_at)
        : null,
      paidTotal: paidTotal > MONEY_EPSILON ? fmt(paidTotal) : null,
      refundAmount: plan.refund_amount > MONEY_EPSILON ? fmt(plan.refund_amount) : null,
      depositKept: plan.deposit_kept > MONEY_EPSILON ? fmt(plan.deposit_kept) : null,
      depositPercentage:
        production.block.deposit_percentage > 0
          ? String(production.block.deposit_percentage)
          : null,
      refundMethodText: refundMethod ? refundMethodLabel(refundMethod, null) : null,
      protocolUrl,
    },
  }).catch((error) => {
    logger.warn(
      `[zakázka] E-mail „Zakázka zrušena" u ${order.id} neodešel: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return false
  })

  await notifyMerchant(container, {
    key: `mn:mto-cancel:${production.block.id}`,
    title:
      trigger === "unpaid_balance"
        ? `Zakázka #${order.display_id} zrušena — doplatek nezaplacen 30 dnů po výzvě`
        : `Zakázka #${order.display_id} zrušena zákazníkem`,
    description: [
      after
        ? `Fáze: po zahájení výroby (e-mail ${formatPragueDateTime(
            production.block.production_start_notified_at
          )}). Záloha ${fmt(plan.deposit_kept)} zůstává, vráceno ${fmt(plan.refund_amount)}.`
        : `Fáze: před zahájením výroby. Vráceno vše: ${fmt(plan.refund_amount)}.`,
      title ? `Výrobek: ${title}` : null,
      trigger === "customer" && (input.reason ?? "").trim()
        ? `Důvod zákazníka: ${(input.reason ?? "").trim()}`
        : null,
      cancel.message,
    ]
      .filter(Boolean)
      .join("\n"),
    audience: "owner",
    urgent: false,
    email: true,
    resource: { id: order.id, type: "order" },
  }).catch(() => undefined)

  return {
    cancelled: true,
    production_order_id: production.productionOrder.id,
    title,
    phase: plan.phase,
    paid_total: paidTotal,
    refund_amount: plan.refund_amount,
    deposit_kept: plan.deposit_kept,
    deposit_amount: production.block.deposit_contract,
    deposit_percentage: production.block.deposit_percentage,
    currency_code: currency,
    request_id: request.id,
    protocol_url: protocolUrl,
    refund_method: refundMethod,
    order_cancelled: cancel.order_cancelled,
    order_completed: cancel.order_completed,
    items_removed: cancel.items_removed,
    email_sent: emailSent,
    message: cancel.message,
  }
}
