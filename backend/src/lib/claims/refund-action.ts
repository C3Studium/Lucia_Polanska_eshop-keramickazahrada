import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { formatMoney, orderLink, sendCustomerEmail } from "../customer-email"
import { issueCreditNoteForOrder } from "../idoklad-invoice"
import {
  claimEmailBase,
  claimService,
  decisionOutcome,
  protocolRefundsOf,
  regenerateProtocol,
  retrieveClaim,
  sendResolvedEmail,
} from "./admin"
import { kindLabel } from "./constants"
import { suggestedRefundAmount } from "./line-items"
import { goodsShipped, loadOrderMoney } from "./money"
import { buildClaimOrderItems, validateRefundItems } from "./order-items"
import {
  commissionPaidRemaining,
  depositRefundable,
  loadClaimProduction,
  type LoadedClaimProduction,
} from "./production"
import {
  canRefund,
  capturedPayments,
  clampRefundAmount,
  isRefundScope,
  MONEY_EPSILON,
  paymentRemaining,
  requestRefunds,
  round2,
  type RefundEntry,
  type RefundHistoryEntry,
  type RefundItemEntry,
  type RefundScope,
} from "./refund-rules"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"

/**
 * Vrácení peněz k jedné žádosti (docs/reklamace-a-zruseni.md §3 „Pravidla
 * refundace") — JEDNA cesta pro tlačítko „Vrátit peníze" i pro „Schválit a
 * vrátit peníze" u odstoupení (route `decide` s `refund_now`).
 *
 * Gating je v `canRefund` (čistá funkce, testovaná): jen `approved`/`received`,
 * u odstoupení/vrácení až po zboží (nebo s vědomým `skip_goods_check`, nebo
 * když zboží nikdy neodešlo), u reklamace ve stavu `approved` jen s
 * rozhodnutím refund/discount. Částka: výchozí = cena vybraných položek
 * (`line_items`, §11.2), bez položek zbývá; nikdy přes zbývá, částečné a
 * opakované povoleno; každá refundace se PŘIDÁ do `refunds` a `refund_amount`
 * je součet. Když nezbývá nic (nebo `mark_resolved`), žádost se uzavře a jde
 * JEDINÝ e-mail „potvrzení o vyřízení"; jinak `order-refunded` za tuhle částku.
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
 *
 * ## Rozsah (§12.3): položky / celek / záloha
 *
 * - `scope: "items"` + `items[{ line_item_id, quantity }]`: částka = Σ cena za
 *   kus × ks, každá položka nejvýš `refundable_quantity` (přes VŠECHNY žádosti
 *   objednávky — tutéž mísu nejde vrátit dvakrát); položky se uloží do záznamu
 *   refundace na žádosti i do `refund_history`.
 * - `scope: "all"`: částka = zbývá (celá objednávka); `amount` v těle má
 *   přednost jen tady (dílčí ruční částka).
 * - `scope: "deposit"`: jen zakázka; částka = zaplacená záloha − už vrácená
 *   záloha, po úspěchu se zapíše `production_order.deposit_refunded`. Je to
 *   rozhodnutí majitelky (§1837 — zákazník nárok nemá), proto výslovný rozsah.
 * - bez `scope`: jako dřív (`amount`, jinak výchozí podle `line_items`, §11.2).
 */

export type RefundClaimBody = {
  amount?: number
  note?: string | null
  skip_goods_check?: boolean
  mark_resolved?: boolean
  /** §12.3 — rozsah refundace; bez něj platí původní chování. */
  scope?: RefundScope
  /** §12.3 — jen pro `scope: "items"`. */
  items?: Array<{ line_item_id: string; quantity: number }>
}

export type RefundClaimResult = {
  refunded: true
  method: "comgate" | "manual"
  amount: number
  remaining: number
  status: string
  credit_note: unknown
  return_request: any
  message: string
  scope: RefundScope | null
  items: RefundItemEntry[] | null
}

const COMGATE_PROVIDER_ID = "pp_comgate_comgate"

const readFreshMetadata = async (
  scope: MedusaContainer,
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

export const refundClaim = async (
  scope: MedusaContainer,
  requestId: string,
  body: RefundClaimBody = {}
): Promise<RefundClaimResult> => {
  const service = claimService(scope)
  const request = await retrieveClaim(scope, requestId)

  const money = await loadOrderMoney(scope, request.order_id)
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

  if (body.scope !== undefined && body.scope !== null && !isRefundScope(body.scope)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Neplatný rozsah refundace — očekává se „items“, „all“, nebo „deposit“."
    )
  }
  const refundScope: RefundScope | null = isRefundScope(body.scope) ? body.scope : null
  const explicitAmount =
    body.amount !== undefined && body.amount !== null && Number(body.amount) > 0
      ? Number(body.amount)
      : null

  // Zakázka se načítá jen když ji rozsah potřebuje (strop zakázkové položky,
  // záloha) — běžná refundace zůstává na dvou dotazech jako dřív.
  let production: LoadedClaimProduction | null = null
  if (refundScope === "items" || refundScope === "deposit") {
    production = await loadClaimProduction(scope, order.id)
  }

  let wanted: number
  let refundItems: RefundItemEntry[] | null = null
  if (refundScope === "items") {
    const items = buildClaimOrderItems({
      order,
      requests: money.requests,
      request,
      commissionPaidRemaining: production ? commissionPaidRemaining(production.block) : null,
    })
    const selection = validateRefundItems(items, body.items)
    // `=== false`, ne `!ok`: bez strictNullChecks TS discriminant pravdivostí nezúží.
    if (selection.ok === false) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, selection.message)
    }
    wanted = selection.amount
    refundItems = selection.items
  } else if (refundScope === "deposit") {
    if (!production) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Objednávka nemá zakázku — záloha se vrací jen u zakázkové výroby."
      )
    }
    const depositLeft = depositRefundable(production.block)
    if (!(depositLeft > MONEY_EPSILON)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        production.block.deposit_paid > MONEY_EPSILON
          ? `Záloha ${formatMoney(production.block.deposit_paid, currency)} už je vrácená.`
          : "U zakázky nebyla zaplacena žádná záloha — není co vracet."
      )
    }
    wanted = depositLeft
  } else if (refundScope === "all") {
    wanted = explicitAmount ?? state.remaining
  } else {
    // Bez rozsahu a bez částky v těle = výchozí podle položek (§11.2):
    // min(zbývá, Σ položek); bez položek celé zbývá. Zadaná částka má přednost.
    wanted = explicitAmount ?? suggestedRefundAmount(state.remaining, request.line_items)
  }
  // Strop „zbývá" platí vždy, ať rozsah říká cokoli.
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
  const note =
    [
      userNote,
      refundScope === "deposit" ? "vrácena záloha zakázky" : null,
      refundScope === "items" ? "za vybrané položky" : null,
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
    // §12.3 — rozsah a položky i v historii objednávky, ať „co se vrátilo za
    // co" přežije i bez modulu.
    ...(refundScope ? { scope: refundScope } : {}),
    ...(refundItems ? { items: refundItems } : {}),
  }

  const orderModule = scope.resolve(Modules.ORDER) as any
  const writeHistory = async (
    mutate: (history: RefundHistoryEntry[]) => RefundHistoryEntry[]
  ) => {
    const fresh = await readFreshMetadata(scope, order.id)
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
      await refundPaymentWorkflow(scope).run({
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
            {
              amount: refundedByCard,
              method: "comgate",
              at: now.toISOString(),
              note,
              scope: refundScope,
              items: refundItems,
            },
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

  // 3) žádost: přidat refundaci (s rozsahem a položkami, §12.3), přepočítat
  //    součet, případně uzavřít.
  const refunds: RefundEntry[] = [
    ...requestRefunds(request),
    { amount, method, at: now.toISOString(), note, scope: refundScope, items: refundItems },
  ]
  const refundedSum = round2(refunds.reduce((sum, entry) => sum + entry.amount, 0))
  const remainingAfter = Math.max(0, round2(state.remaining - amount))
  const resolveNow = remainingAfter <= MONEY_EPSILON || body.mark_resolved === true

  // 3b) záloha zakázky: zapsat, kolik ze zálohy se vrátilo — z toho je krok
  //     „Záloha vrácena" a podmínka „Zrušit zakázku" (§12.4). Peníze už
  //     odešly; když zápis selže, řekne to hláška, ať to majitelka vidí.
  let depositNote = ""
  if (refundScope === "deposit" && production) {
    const refundedDeposit = round2(production.block.deposit_refunded + amount)
    await scope
      .resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
      .updateProductionOrders({
        id: production.productionOrder.id,
        deposit_refunded: refundedDeposit,
        deposit_refunded_at: now,
      } as never)
      .then(() => {
        depositNote =
          refundedDeposit >= production!.block.deposit_paid - MONEY_EPSILON
            ? " Záloha zakázky je vrácená celá."
            : ` Ze zálohy zakázky vráceno ${formatMoney(refundedDeposit, currency)} z ${formatMoney(
                production!.block.deposit_paid,
                currency
              )}.`
      })
      .catch((error) => {
        depositNote = ` Vrácenou zálohu se nepodařilo zapsat k zakázce (${
          error instanceof Error ? error.message : String(error)
        }).`
      })
  }

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
  const freshOrder = { ...order, metadata: await readFreshMetadata(scope, order.id) }
  const creditNote = await issueCreditNoteForOrder(scope, freshOrder, {
    amount: refundedSum,
  }).catch(() => ({ status: "error" as const, reason: "neznámá chyba" }))

  // 5) protokol s řádky refundací; u uzavření jako potvrzení o vyřízení.
  const protocol = await regenerateProtocol(scope, updated, {
    outcome: decisionOutcome(updated),
    note: updated.resolution_note ?? request.decision_note ?? null,
    decidedAt: now,
    confirmation: resolveNow,
    refunds: protocolRefundsOf(updated, currency),
  })

  // 6) JEDEN e-mail: potvrzení o vyřízení, nebo „vracíme peníze" za dílčí částku.
  if (resolveNow) {
    await sendResolvedEmail(scope, updated, {
      protocolUrl: protocol.url,
      currency,
      note: updated.resolution_note ?? null,
    })
  } else {
    await sendCustomerEmail(scope, {
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

  const scopeLabel =
    refundScope === "deposit"
      ? " (záloha zakázky)"
      : refundScope === "items"
        ? ` (${refundItems?.reduce((sum, item) => sum + item.quantity, 0) ?? 0} ks vybraných položek)`
        : ""
  const baseMessage =
    method === "comgate"
      ? `Vráceno ${formatMoney(amount - manualPart, currency)}${scopeLabel} na kartu přes ComGate.${
          manualPart > MONEY_EPSILON
            ? ` Zbývajících ${formatMoney(manualPart, currency)} karta nepokryla — vraťte ručně.`
            : ""
        }`
      : `Zaznamenáno ${formatMoney(amount, currency)}${scopeLabel} k ručnímu vrácení (objednávka nebyla placená kartou).`
  const clampMessage = clamped
    ? ` Částka seříznuta na zbývajících ${formatMoney(amount, currency)}.`
    : ""
  const creditMessage =
    (creditNote as any).status === "issued"
      ? ` Dobropis ${(creditNote as any).number ?? ""} vystaven.`
      : (creditNote as any).status === "exists"
        ? " Dobropis už byl vystaven."
        : ""
  const closeMessage = resolveNow
    ? " Žádost je vyřízená, zákazník dostal potvrzení."
    : ` Zbývá ${formatMoney(remainingAfter, currency)}.`

  return {
    refunded: true,
    method,
    amount,
    remaining: remainingAfter,
    status: updated.status,
    credit_note: creditNote,
    return_request: { ...updated, protocol_url: protocol.url ?? updated.protocol_url },
    message: `${baseMessage}${clampMessage}${depositNote}${creditMessage}${closeMessage}`,
    scope: refundScope,
    items: refundItems,
  }
}
