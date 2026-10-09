import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { formatMoney, orderLink, sendCustomerEmail } from "../../../../../lib/customer-email"
import { issueCreditNoteForOrder } from "../../../../../lib/idoklad-invoice"
import {
  claimEmailBase,
  claimService,
  decisionOutcome,
  protocolRefundsOf,
  regenerateProtocol,
  retrieveClaim,
  sendResolvedEmail,
} from "../../../../../lib/claims/admin"
import { kindLabel } from "../../../../../lib/claims/constants"
import { suggestedRefundAmount } from "../../../../../lib/claims/line-items"
import { goodsShipped, loadOrderMoney } from "../../../../../lib/claims/money"
import {
  canRefund,
  capturedPayments,
  clampRefundAmount,
  MONEY_EPSILON,
  paymentRemaining,
  requestRefunds,
  round2,
  type RefundEntry,
  type RefundHistoryEntry,
} from "../../../../../lib/claims/refund-rules"

/**
 * POST /admin/return-requests/:id/refund — vrácení peněz k jedné žádosti
 * (docs/reklamace-a-zruseni.md §3 „Pravidla refundace").
 *
 * Gating je v `canRefund` (čistá funkce, testovaná): jen `approved`/`received`,
 * u odstoupení/vrácení až po zboží (nebo s vědomým `skip_goods_check`), u
 * reklamace ve stavu `approved` jen s rozhodnutím refund/discount. Částka:
 * výchozí = cena vybraných položek (`line_items`, §11.2), bez položek zbývá;
 * nikdy přes zbývá, částečné a opakované povoleno; každá refundace se PŘIDÁ
 * do `refunds` a `refund_amount` je součet. Když nezbývá
 * nic (nebo `mark_resolved`), žádost se uzavře a jde JEDINÝ e-mail
 * „potvrzení o vyřízení"; jinak `order-refunded` za tuhle částku.
 *
 * Reuse téhož enginu jako „Vrátit rozdíl": karta → ComGate přes
 * `refundPaymentWorkflow` (idempotentní, hlídá přeplatek), jinak „manual".
 *
 * ## Pořadí kroků a proč
 *
 * 1. Stopa do `refund_history` jde PŘED refundací. `payment.refunded` ze
 *    workflow stihne subscriber `onPaymentRefunded` dřív, než se sem vrátí
 *    řízení — a ten podle poslední položky historie pozná, že má mlčet
 *    (jeden e-mail za refundaci). Když ComGate selže, stopa se zase odebere.
 * 2. Metadata se před každým patchem čtou ČERSTVĚ. Dobropis
 *    (`issueCreditNoteForOrder`) patchuje metadata z objektu, který dostane —
 *    dostává ten s právě zapsanou historií, takže ji nepřepíše (dřívější chyba).
 * 3. Částky přes `toNumber` (BigNumber tvar z query.graph).
 */

type RefundBody = {
  amount?: number
  note?: string | null
  skip_goods_check?: boolean
  mark_resolved?: boolean
}

const COMGATE_PROVIDER_ID = "pp_comgate_comgate"

const readFreshMetadata = async (
  scope: MedusaRequest["scope"],
  orderId: string
): Promise<Record<string, unknown>> => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { id: orderId },
  })
  return ((data[0] as any)?.metadata ?? {}) as Record<string, unknown>
}

const historyOf = (metadata: Record<string, unknown>): RefundHistoryEntry[] =>
  Array.isArray(metadata.refund_history)
    ? (metadata.refund_history as RefundHistoryEntry[])
    : []

const sameEntry = (a: RefundHistoryEntry, b: RefundHistoryEntry) =>
  a?.return_request_id === b.return_request_id && a?.refunded_at === b.refunded_at

export const POST = async (
  req: MedusaRequest<RefundBody>,
  res: MedusaResponse
) => {
  const body = (req.body || {}) as RefundBody
  const service = claimService(req.scope)
  const request = await retrieveClaim(req.scope, req.params.id)

  const money = await loadOrderMoney(req.scope, request.order_id)
  if (!money) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka k této žádosti nebyla nalezena."
    )
  }
  const { order, state } = money
  const currency = order.currency_code ?? "czk"

  // Odstoupení před odesláním: zboží nikdy neodešlo → není na co čekat.
  const goodsNeverShipped = !goodsShipped(order)
  const verdict = canRefund({ ...request, goods_shipped: !goodsNeverShipped }, body)
  if (!verdict.allowed) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      verdict.reason ?? "Peníze u této žádosti teď vrátit nejde."
    )
  }

  // Bez částky v těle = výchozí podle položek (§11.2): min(zbývá, Σ položek);
  // bez položek celé zbývá. Zadaná částka má přednost, strop „zbývá" platí vždy.
  const wanted =
    body.amount !== undefined && body.amount !== null && Number(body.amount) > 0
      ? body.amount
      : suggestedRefundAmount(state.remaining, request.line_items)
  const { amount, clamped } = clampRefundAmount(wanted, state.remaining)
  if (!(amount > MONEY_EPSILON)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Není co vrátit — zachyceno ${formatMoney(state.captured, currency)}, vráceno ${formatMoney(
        state.refunded,
        currency
      )}. Je-li žádost hotová, použijte „Vyřízeno".`
    )
  }

  const userNote = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null
  // Vědomé vrácení bez čekání na zboží se zapíše k refundaci — §1832/4 dává
  // právo počkat a tady se ho majitelka výslovně vzdala.
  const skippedGoods =
    body.skip_goods_check === true &&
    request.status === "approved" &&
    (request.kind === "odstoupeni" || request.kind === "vraceni")
  const note = [
    userNote,
    skippedGoods ? "vráceno bez čekání na zboží" : null,
    goodsNeverShipped && request.status === "approved" ? "zboží neodešlo" : null,
  ]
    .filter(Boolean)
    .join(" — ") || null

  const now = new Date()
  const historyEntry: RefundHistoryEntry & Record<string, unknown> = {
    amount,
    currency_code: currency,
    reason: `return:${request.kind ?? "vraceni"}`,
    method: "manual",
    refunded_at: now.toISOString(),
    return_request_id: request.id,
    ...(note ? { note } : {}),
  }

  const orderModule = req.scope.resolve(Modules.ORDER) as any
  const writeHistory = async (
    mutate: (history: RefundHistoryEntry[]) => RefundHistoryEntry[]
  ) => {
    const fresh = await readFreshMetadata(req.scope, order.id)
    await orderModule.updateOrders([
      { id: order.id, metadata: { ...fresh, refund_history: mutate(historyOf(fresh)) } },
    ])
  }

  // Karta: refundace přes ComGate — po platbách s nevyčerpaným zbytkem (záloha
  // + doplatek jsou dvě platby). Co karty nepokryjí, vrací majitelka ručně.
  const cardPayments = capturedPayments(order).filter(
    (payment) =>
      payment.provider_id === COMGATE_PROVIDER_ID &&
      paymentRemaining(payment) > MONEY_EPSILON
  )
  const method: "comgate" | "manual" = cardPayments.length ? "comgate" : "manual"
  historyEntry.method = method

  // 1) stopa napřed (viz hlavička) …
  await writeHistory((history) => [...history, historyEntry])

  // 2) … pak peníze. Selhání: stopu zúžit na to, co reálně odešlo, nebo odebrat.
  let left = amount
  let refundedByCard = 0
  try {
    for (const payment of cardPayments) {
      if (left <= MONEY_EPSILON) break
      const part = round2(Math.min(left, paymentRemaining(payment)))
      if (part <= MONEY_EPSILON) continue
      await refundPaymentWorkflow(req.scope).run({
        input: {
          payment_id: payment.id,
          amount: part,
          note:
            userNote ??
            `Vrácení k žádosti (${kindLabel(request.kind)}) — objednávka #${order.display_id}`,
        } as never,
      })
      refundedByCard = round2(refundedByCard + part)
      left = round2(left - part)
    }
  } catch (error) {
    await writeHistory((history) =>
      refundedByCard > MONEY_EPSILON
        ? history.map((entry) =>
            sameEntry(entry, historyEntry) ? { ...entry, amount: refundedByCard } : entry
          )
        : history.filter((entry) => !sameEntry(entry, historyEntry))
    ).catch(() => undefined)
    if (refundedByCard > MONEY_EPSILON) {
      // Část už odešla — zapsat na žádost, ať součet sedí s realitou.
      await service
        .updateReturnRequests({
          id: request.id,
          refunds: [
            ...requestRefunds(request),
            { amount: refundedByCard, method: "comgate", at: now.toISOString(), note },
          ] as unknown as Record<string, unknown>,
          refund_amount: round2(
            requestRefunds(request).reduce((sum, entry) => sum + entry.amount, 0) +
              refundedByCard
          ),
          refund_method: "comgate",
          refunded_at: now,
        })
        .catch(() => undefined)
    }
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `ComGate refundaci odmítl${
        refundedByCard > MONEY_EPSILON
          ? ` po ${formatMoney(refundedByCard, currency)} z ${formatMoney(amount, currency)}`
          : ""
      }: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  const manualPart = method === "comgate" ? left : amount

  // 3) žádost: přidat refundaci, přepočítat součet, případně uzavřít.
  const refunds: RefundEntry[] = [
    ...requestRefunds(request),
    { amount, method, at: now.toISOString(), note },
  ]
  const refundedSum = round2(refunds.reduce((sum, entry) => sum + entry.amount, 0))
  const remainingAfter = Math.max(0, round2(state.remaining - amount))
  const resolveNow = remainingAfter <= MONEY_EPSILON || body.mark_resolved === true

  const updated = await service.updateReturnRequests({
    id: request.id,
    refunds: refunds as unknown as Record<string, unknown>,
    refund_amount: refundedSum,
    refund_method: method,
    refunded_at: now,
    ...(resolveNow
      ? {
          status: "resolved",
          resolved_at: now,
          resolution_note: userNote ?? request.resolution_note ?? null,
          resolution: request.resolution ?? "refund",
        }
      : {}),
  })

  // 4) dobropis — s ČERSTVÝMI metadaty včetně historie (viz hlavička). Součet
  //    za žádost: dvě částečné, které dají celek, vystaví plný dobropis až na
  //    konci; částečná jen připomene ruční vystavení.
  const freshOrder = { ...order, metadata: await readFreshMetadata(req.scope, order.id) }
  const creditNote = await issueCreditNoteForOrder(req.scope, freshOrder, {
    amount: refundedSum,
  }).catch(() => ({ status: "error" as const, reason: "neznámá chyba" }))

  // 5) protokol s řádky refundací; u uzavření jako potvrzení o vyřízení.
  const protocol = await regenerateProtocol(req.scope, updated, {
    outcome: decisionOutcome(updated),
    note: updated.resolution_note ?? request.decision_note ?? null,
    decidedAt: now,
    confirmation: resolveNow,
    refunds: protocolRefundsOf(updated, currency),
  })

  // 6) JEDEN e-mail: potvrzení o vyřízení, nebo „vracíme peníze" za dílčí částku.
  if (resolveNow) {
    await sendResolvedEmail(req.scope, updated, {
      protocolUrl: protocol.url,
      currency,
      note: updated.resolution_note ?? null,
    })
  } else {
    await sendCustomerEmail(req.scope, {
      template: "order-refunded",
      to: request.email,
      key: `return-refund:${request.id}:${refunds.length}`,
      orderId: request.order_id,
      data: {
        ...claimEmailBase(updated, protocol.url),
        refundAmount: formatMoney(amount, currency),
        refundReason: kindLabel(request.kind),
        orderLink: orderLink(order) || undefined,
      },
    })
  }

  const baseMessage =
    method === "comgate"
      ? `Vráceno ${formatMoney(amount - manualPart, currency)} na kartu přes ComGate.${
          manualPart > MONEY_EPSILON
            ? ` Zbývajících ${formatMoney(manualPart, currency)} karta nepokryla — vraťte ručně.`
            : ""
        }`
      : `Zaznamenáno ${formatMoney(amount, currency)} k ručnímu vrácení (objednávka nebyla placená kartou).`
  const clampMessage = clamped
    ? ` Částka seříznuta na zbývajících ${formatMoney(amount, currency)}.`
    : ""
  const creditMessage =
    creditNote.status === "issued"
      ? ` Dobropis ${creditNote.number ?? ""} vystaven.`
      : creditNote.status === "exists"
        ? " Dobropis už byl vystaven."
        : ""
  const closeMessage = resolveNow
    ? " Žádost je vyřízená, zákazník dostal potvrzení."
    : ` Zbývá ${formatMoney(remainingAfter, currency)}.`

  res.status(200).json({
    refunded: true,
    method,
    amount,
    remaining: remainingAfter,
    status: updated.status,
    credit_note: creditNote,
    return_request: { ...updated, protocol_url: protocol.url ?? updated.protocol_url },
    message: `${baseMessage}${clampMessage}${creditMessage}${closeMessage}`,
  })
}
