import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { formatMoney, orderLink, sendCustomerEmail } from "../customer-email"
import { issueCreditNoteForRefund } from "../idoklad-invoice"
import {
  claimEmailBase,
  claimService,
  creditNoteEmailData,
  decisionOutcome,
  protocolRefundsOf,
  refundMethodLabel,
  regenerateProtocol,
  retrieveClaim,
  sendResolvedEmail,
} from "./admin"
import { attachComponents, loadBundleComponentSources } from "./bundle-components"
import {
  comgateConfirmationOf,
  manualConfirmation,
  providerConfirmationText,
  type ProviderConfirmation,
} from "./comgate-confirmation"
import { isEditRefundKind, kindLabel } from "./constants"
import { storedRefundAccount } from "./refund-account"
import { lineItemsTotal } from "./line-items"
import { goodsShipped, loadOrderMoney } from "./money"
import { buildClaimOrderItems } from "./order-items"
import {
  commissionPaidRemaining,
  depositRefundable,
  loadClaimProduction,
  type LoadedClaimProduction,
} from "./production"
import {
  clampLinesToRemaining,
  DEPOSIT_LINE_LABEL,
  itemsMirrorOf,
  legacyBodyToLines,
  MANUAL_AMOUNT_LABEL,
  priceRefundLines,
  refundAllLines,
  refundLinesText,
  REFUND_LINES_REQUIRED,
  shippingRefundAllowedFor,
  shippingStateOf,
  type RefundLineInput,
} from "./refund-lines"
import {
  canRefund,
  capturedPayments,
  clampRefundAmount,
  isRefundScope,
  MONEY_EPSILON,
  paymentRemaining,
  requestRefunds,
  round2,
  type RefundCreditNote,
  type RefundEntry,
  type RefundHistoryEntry,
  type RefundItemEntry,
  type RefundLine,
  type RefundScope,
} from "./refund-rules"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"

/**
 * Vrácení peněz k jedné žádosti (docs/reklamace-a-zruseni.md §3 „Pravidla
 * refundace", §12.3, §13.2–13.4) — JEDNA cesta pro tlačítko „Vrátit peníze" i
 * pro „Schválit a vrátit peníze" u odstoupení (route `decide` s `refund_now`).
 *
 * Gating je v `canRefund` (čistá funkce, testovaná): jen `approved`/`received`,
 * u odstoupení/vrácení až po zboží (nebo s vědomým `skip_goods_check`, nebo
 * když zboží nikdy neodešlo), u reklamace ve stavu `approved` jen s
 * rozhodnutím refund/discount.
 *
 * ## Částka = košík (§13.2), nikdy výchozí
 *
 * Částku SESTAVÍ majitelka z řádků `lines[]` (položka / komponenta balíčku /
 * poštovné / ruční částka); server je ocení (`priceRefundLines`), ohlídá
 * stropy (položka a komponenta jen jednou přes všechny žádosti, poštovné
 * jednou za objednávku, celkem ≤ zbývá) a uloží je k refundaci i do
 * `refund_history`. Staré tělo se mapuje: `items` → řádky položek, `amount`
 * → ruční řádek. Rozsahy zůstávají jako VÝSLOVNÁ tlačítka: `all` = všechny
 * zbývající kusy + poštovné (seřízne se na zbývá), `deposit` = záloha zakázky
 * (beze změny). Bez košíku, rozsahu i částky se refundace odmítne — žádné
 * číslo se nedoplňuje za majitelku.
 *
 * ## Pořadí kroků a proč
 *
 * 1. Stopa do `refund_history` jde PŘED refundací. `payment.refunded` ze
 *    workflow stihne subscriber `onPaymentRefunded` dřív, než se sem vrátí
 *    řízení — a ten podle poslední položky historie pozná, že má mlčet
 *    (jeden e-mail za refundaci). Když ComGate selže, stopa se zase odebere.
 * 2. Peníze: karta → ComGate přes `refundPaymentWorkflow` (idempotentní,
 *    hlídá přeplatek), po platbách s nevyčerpaným zbytkem (záloha + doplatek
 *    jsou dvě platby); co karta nepokryje, vrací majitelka ručně. Po každém
 *    úspěšném workflow se přečtou data platby — potvrzení ComGate (§13.4,
 *    `comgate-confirmation.ts`) jde na záznam refundace.
 * 3. Žádost: záznam s košíkem a potvrzením, součet, případně uzavření.
 * 4. Dobropis za KAŽDOU refundaci (§13.3, `issueCreditNoteForRefund`) —
 *    s ČERSTVÝMI metadaty (historie z kroku 1 se nesmí přepsat); výsledek se
 *    dopíše na záznam refundace, ať ho e-mail, protokol i admin čtou z
 *    jednoho místa. Zkušební režim = `skipped` s důvodem, který jde do
 *    hlášky i zákazníkovi.
 * 5. Protokol s řádky košíku a číslem dobropisu; u uzavření jako potvrzení
 *    o vyřízení.
 * 6. JEDEN e-mail: potvrzení o vyřízení, nebo „vracíme peníze" za tuhle
 *    částku — oba s košíkem, způsobem (karta ComGate / ručně) a dobropisem.
 *
 * Částky přes `toNumber` (BigNumber tvar z query.graph).
 */

export type RefundClaimBody = {
  /** Staré tělo (§12.3): ruční částka → ruční řádek košíku. */
  amount?: number
  note?: string | null
  skip_goods_check?: boolean
  mark_resolved?: boolean
  /** §12.3 — výslovná tlačítka `all` / `deposit`; `items` = staré tělo položek. */
  scope?: RefundScope
  /** Staré tělo (§12.3) — mapuje se na řádky `item`. */
  items?: Array<{ line_item_id: string; quantity: number }>
  /** §13.2 — košík vrácení. */
  lines?: RefundLineInput[]
}

export type RefundClaimResult = {
  refunded: true
  /** Id záznamu refundace (`refunds[].id`) — klíč dobropisu. */
  refund_id: string
  method: "comgate" | "manual"
  amount: number
  remaining: number
  status: string
  credit_note: RefundCreditNote | null
  provider: ProviderConfirmation | null
  return_request: any
  message: string
  scope: RefundScope | null
  /** Zrcadlo řádků položek (§12.3) pro starší čtenáře. */
  items: RefundItemEntry[] | null
  /** §13.2 — oceněný košík, jak se uložil. */
  lines: RefundLine[]
}

const COMGATE_PROVIDER_ID = "pp_comgate_comgate"

/**
 * Pokyn k ručnímu převodu do hlášky majitelce: účet ze žádosti + VS = číslo
 * objednávky, nebo výzva účet doplnit (bez něj peníze nemá kam poslat).
 */
export const manualTransferText = (account: unknown, displayId: unknown): string => {
  const stored = storedRefundAccount(account)
  return stored
    ? `pošlete převodem na účet ${stored.display} (VS ${displayId ?? ""}).`
    : "pošlete převodem — zákazník číslo účtu nevyplnil: doplňte ho u žádosti (pole „Účet pro vrácení“), nebo si ho vyžádejte e-mailem."
}

/** `refunds[].id`: žádost + pořadí — stabilní klíč pro dobropis a historii. */
export const refundEntryId = (requestId: string, index: number): string =>
  `${requestId}:${index}`

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

/** Data relace platby po refundu (§13.4) — null, když se nedají přečíst. */
const readPaymentData = async (
  scope: MedusaContainer,
  paymentId: string
): Promise<Record<string, unknown> | null> => {
  try {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "payment",
      fields: ["id", "data"],
      filters: { id: paymentId },
    })
    const payload = (data[0] as any)?.data
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const historyOf = (metadata: Record<string, unknown>): RefundHistoryEntry[] =>
  Array.isArray(metadata.refund_history)
    ? (metadata.refund_history as RefundHistoryEntry[])
    : []

const sameEntry = (a: RefundHistoryEntry, b: RefundHistoryEntry) =>
  a?.return_request_id === b.return_request_id && a?.refunded_at === b.refunded_at

const creditNoteOfResult = (
  result: Awaited<ReturnType<typeof issueCreditNoteForRefund>>
): RefundCreditNote => ({
  status: result.status,
  number: result.number ?? null,
  pdf_url: result.pdf_url ?? null,
  reason: result.reason ?? null,
})

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
  const fmt = (value: number) => formatMoney(value, currency)

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

  // Zakázka: strop zakázkové položky (zaplaceno) a záloha. Vždy — košík může
  // obsahovat zakázkový řádek bez ohledu na rozsah.
  const production: LoadedClaimProduction | null = await loadClaimProduction(scope, order.id)
  const baseItems = buildClaimOrderItems({
    order,
    requests: money.requests,
    request,
    commissionPaidRemaining: production ? commissionPaidRemaining(production.block) : null,
  })
  // Poštovné jen u odstoupení / vrácení — reklamace vrací cenu výrobků.
  const shipping = shippingStateOf(order, money.requests, {
    allowRefund: shippingRefundAllowedFor(request.kind),
  })

  // --- košík (§13.2) ----------------------------------------------------------
  let lines: RefundLine[]
  let amount: number
  let clamped = false
  if (refundScope === "deposit") {
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
          ? `Záloha ${fmt(production.block.deposit_paid)} už je vrácená.`
          : "U zakázky nebyla zaplacena žádná záloha — není co vracet."
      )
    }
    const clampedDeposit = clampRefundAmount(depositLeft, state.remaining)
    amount = clampedDeposit.amount
    clamped = clampedDeposit.clamped
    lines = [
      { type: "custom", title: DEPOSIT_LINE_LABEL, quantity: 1, unit_total: amount, amount },
    ]
  } else {
    let rawLines: unknown[] | null
    let clampToRemaining = false
    if (refundScope === "all") {
      // „Vrátit vše" (`refundAllLines`): odstoupení / vrácení = celá
      // objednávka i s poštovným, reklamace = jen reklamované výrobky. Ruční
      // částka v těle má přednost jen tady (dílčí ruční částka, §12.3).
      clampToRemaining = true
      rawLines = explicitAmount
        ? [{ type: "custom", amount: explicitAmount, label: MANUAL_AMOUNT_LABEL }]
        : refundAllLines(baseItems, shipping, state.remaining)
      if (!rawLines.length && !shipping.allowed) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Za reklamované výrobky už je všechno vrácené. Poštovné se u reklamace nevrací; jinou částku vraťte v košíku."
        )
      }
    } else {
      rawLines = legacyBodyToLines(body)
    }
    if (!rawLines || !rawLines.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, REFUND_LINES_REQUIRED)
    }

    // Komponenty balíčku (§13.5) se dohledávají jen když je košík chce.
    const needsComponents = rawLines.some((line: any) => line?.type === "component")
    const items = needsComponents
      ? attachComponents(
          baseItems,
          await loadBundleComponentSources(scope, order, baseItems),
          money.requests
        )
      : baseItems

    const priced = priceRefundLines({
      items,
      shipping,
      lines: rawLines,
      remaining: state.remaining,
      clampToRemaining,
      fmt,
    })
    // `=== false`, ne `!ok`: bez strictNullChecks TS discriminant pravdivostí nezúží.
    if (priced.ok === false) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, priced.message)
    }
    lines = priced.lines
    amount = priced.amount
    clamped = priced.clamped
  }
  if (!(amount > MONEY_EPSILON)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Není co vrátit — zachyceno ${fmt(state.captured)}, vráceno ${fmt(
        state.refunded
      )}. Je-li žádost hotová, použijte „Vyřízeno".`
    )
  }
  // Rozdíl z úpravy objednávky: přes tuhle žádost se vrací jen rozdíl, nikdy
  // celá objednávka („vrátit vše" tu UI nenabízí, server to hlídá taky).
  if (isEditRefundKind(request.kind)) {
    const expected = lineItemsTotal(request.line_items)
    const alreadyHere = round2(
      ((Array.isArray(request.refunds) ? request.refunds : []) as any[]).reduce(
        (sum, entry) => sum + (Number(entry?.amount) || 0),
        0
      )
    )
    if (refundScope === "all" || refundScope === "deposit") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `U rozdílu z úpravy se vrací jen rozdíl ${fmt(expected)} — zadejte ho v košíku jako částku.`
      )
    }
    if (round2(alreadyHere + amount) > expected + MONEY_EPSILON) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Rozdíl z úpravy je ${fmt(expected)}${
          alreadyHere > MONEY_EPSILON ? `, vráceno už ${fmt(alreadyHere)}` : ""
        } — víc přes tuto žádost vrátit nejde.`
      )
    }
  }
  const refundItems: RefundItemEntry[] | null = (() => {
    const mirror = itemsMirrorOf(lines)
    return mirror.length ? mirror : null
  })()

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
      refundScope === "all" ? "celá objednávka" : null,
      skippedGoods ? "vráceno bez čekání na zboží" : null,
      goodsNeverShipped && request.status === "approved" ? "zboží neodešlo" : null,
    ]
      .filter(Boolean)
      .join(" — ") || null

  const now = new Date()
  const existingRefunds = requestRefunds(request)
  const refundId = refundEntryId(request.id, existingRefunds.length + 1)
  const historyEntry: RefundHistoryEntry & Record<string, unknown> = {
    amount,
    currency_code: currency,
    reason: `return:${request.kind ?? "vraceni"}`,
    method: "manual",
    refunded_at: now.toISOString(),
    return_request_id: request.id,
    refund_id: refundId,
    ...(note ? { note } : {}),
    // §12.3 / §13.2 — rozsah, položky i košík i v historii objednávky, ať
    // „co se vrátilo za co" přežije i bez modulu.
    ...(refundScope ? { scope: refundScope } : {}),
    ...(refundItems ? { items: refundItems } : {}),
    lines,
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
  const touchedPayments: Array<Record<string, unknown> | null> = []
  try {
    for (const payment of cardPayments) {
      if (left <= MONEY_EPSILON) break
      const part = round2(Math.min(left, paymentRemaining(payment)))
      if (part <= MONEY_EPSILON) continue
      await refundPaymentWorkflow(scope).run({
        input: {
          payment_id: payment.id,
          amount: part,
          // Poznámka jde na řádek refundace Medusy (`payment_refund.note`) —
          // workflow vlastní idempotency klíč nebere, posílá providerovi id
          // toho řádku (viz comgate-confirmation.ts).
          note:
            userNote ??
            `Vrácení k žádosti (${kindLabel(request.kind)}) — objednávka #${order.display_id} [${refundId}]`,
        } as never,
      })
      refundedByCard = round2(refundedByCard + part)
      left = round2(left - part)
      touchedPayments.push(payment.id ? await readPaymentData(scope, payment.id) : null)
    }
  } catch (error) {
    await writeHistory((history) =>
      refundedByCard > MONEY_EPSILON
        ? history.map((entry) =>
            sameEntry(entry, historyEntry)
              ? { ...entry, amount: refundedByCard, ...clampLinesToRemaining(lines, refundedByCard) }
              : entry
          )
        : history.filter((entry) => !sameEntry(entry, historyEntry))
    ).catch(() => undefined)
    if (refundedByCard > MONEY_EPSILON) {
      // Část už odešla — zapsat na žádost, ať součet sedí s realitou.
      const partial = clampLinesToRemaining(lines, refundedByCard)
      await service
        .updateReturnRequests({
          id: request.id,
          refunds: [
            ...existingRefunds,
            {
              id: refundId,
              amount: refundedByCard,
              method: "comgate",
              at: now.toISOString(),
              note,
              scope: refundScope,
              items: itemsMirrorOf(partial.lines),
              lines: partial.lines,
              ...comgateConfirmationOf(touchedPayments, now),
            },
          ] as unknown as Record<string, unknown>,
          refund_amount: round2(
            existingRefunds.reduce((sum, entry) => sum + entry.amount, 0) + refundedByCard
          ),
          refund_method: "comgate",
          refunded_at: now,
        })
        .catch(() => undefined)
    }
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `ComGate refundaci odmítl${
        refundedByCard > MONEY_EPSILON ? ` po ${fmt(refundedByCard)} z ${fmt(amount)}` : ""
      }: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  const manualPart = method === "comgate" ? left : amount
  const confirmation: ProviderConfirmation =
    method === "comgate" ? comgateConfirmationOf(touchedPayments, now) : manualConfirmation(now)

  // 3) žádost: přidat refundaci (s košíkem a potvrzením), přepočítat součet,
  //    případně uzavřít.
  const entry: RefundEntry = {
    id: refundId,
    amount,
    method,
    at: now.toISOString(),
    note,
    scope: refundScope,
    items: refundItems,
    lines,
    ...confirmation,
    credit_note: null,
  }
  const refunds: RefundEntry[] = [...existingRefunds, entry]
  const refundedSum = round2(refunds.reduce((sum, item) => sum + item.amount, 0))
  const remainingAfter = Math.max(0, round2(state.remaining - amount))
  // Rozdíl z úpravy objednávky (`uprava`): „zbývá" na nulu nespadne (zbytek
  // je zaplacené zboží, které zákazník dostane) — vyřízeno je, když se vrátil
  // celý očekávaný rozdíl (jediný řádek žádosti).
  const editRefundSettled =
    isEditRefundKind(request.kind) &&
    refundedSum >= lineItemsTotal(request.line_items) - MONEY_EPSILON
  const resolveNow =
    remainingAfter <= MONEY_EPSILON || editRefundSettled || body.mark_resolved === true

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
            : ` Ze zálohy zakázky vráceno ${fmt(refundedDeposit)} z ${fmt(
                production!.block.deposit_paid
              )}.`
      })
      .catch((error) => {
        depositNote = ` Vrácenou zálohu se nepodařilo zapsat k zakázce (${
          error instanceof Error ? error.message : String(error)
        }).`
      })
  }

  let updated = await service.updateReturnRequests({
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

  // 4) dobropis za TUHLE refundaci (§13.3) — s ČERSTVÝMI metadaty včetně
  //    historie (viz hlavička). Výsledek na záznam refundace.
  const freshOrder = { ...order, metadata: await readFreshMetadata(scope, order.id) }
  const creditNote = creditNoteOfResult(
    await issueCreditNoteForRefund(scope, freshOrder, {
      id: refundId,
      amount,
      lines,
      currency,
      // Důvod opravného dokladu pro iDoklad (`CreditNoteReason`, povinné).
      reason: kindLabel(request.kind),
    } as never).catch((error) => ({
      status: "error" as const,
      reason: error instanceof Error ? error.message : "neznámá chyba",
    }))
  )
  updated = await service
    .updateReturnRequests({
      id: request.id,
      refunds: refunds.map((item) =>
        item.id === refundId ? { ...item, credit_note: creditNote } : item
      ) as unknown as Record<string, unknown>,
    })
    .catch(() => updated)

  // 5) protokol s řádky refundací (košík + dobropis); u uzavření jako
  //    potvrzení o vyřízení.
  const protocol = await regenerateProtocol(scope, updated, {
    outcome: decisionOutcome(updated),
    note: updated.resolution_note ?? request.decision_note ?? null,
    decidedAt: now,
    confirmation: resolveNow,
    refunds: protocolRefundsOf(updated, currency),
  })

  // 6) JEDEN e-mail: potvrzení o vyřízení, nebo „vracíme peníze" za dílčí částku.
  const refundLines = refundLinesText(lines, currency)
  if (resolveNow) {
    await sendResolvedEmail(scope, updated, {
      protocolUrl: protocol.url,
      currency,
      note: updated.resolution_note ?? null,
      creditNote,
    })
  } else {
    await sendCustomerEmail(scope, {
      template: "order-refunded",
      to: request.email,
      key: `return-refund:${request.id}:${refunds.length}`,
      orderId: request.order_id,
      data: {
        ...claimEmailBase(updated, protocol.url),
        refundAmount: fmt(amount),
        refundReason: kindLabel(request.kind),
        refundMethod: refundMethodLabel(method, request.refund_account),
        ...(refundLines ? { refundLines } : {}),
        ...creditNoteEmailData(refunds, creditNote),
        orderLink: orderLink(order) || undefined,
      },
    })
  }

  // --- hláška pro majitelku ------------------------------------------------------
  const pieces = lines
    .filter((line) => line.type === "item" || line.type === "component")
    .reduce((sum, line) => sum + (line.quantity ?? 0), 0)
  const scopeLabel =
    refundScope === "deposit"
      ? " (záloha zakázky)"
      : refundScope === "all"
        ? " (celá objednávka)"
        : pieces > 0
          ? ` (${pieces} ks, ${lines.length} ${lines.length === 1 ? "řádek" : "řádky"} košíku)`
          : ""
  const providerText = providerConfirmationText(confirmation)
  // Ruční část = převod, který posílá majitelka — hláška říká kam a s jakým VS.
  const transferText = manualTransferText(request.refund_account, order.display_id)
  const baseMessage =
    method === "comgate"
      ? `Vráceno ${fmt(amount - manualPart)}${scopeLabel} na kartu přes ComGate${
          providerText ? ` — ${providerText}` : ""
        }.${
          manualPart > MONEY_EPSILON
            ? ` Zbývajících ${fmt(manualPart)} karta nepokryla — ${transferText}`
            : ""
        }`
      : `Zaznamenáno ${fmt(amount)}${scopeLabel} — objednávka nebyla placená kartou, peníze teď ${transferText}`
  const clampMessage = clamped ? ` Částka seříznuta na zbývajících ${fmt(amount)}.` : ""
  const creditMessage =
    creditNote.status === "issued"
      ? ` Dobropis ${creditNote.number ?? ""} vystaven.`
      : creditNote.status === "exists"
        ? " Dobropis už byl vystaven."
        : creditNote.status === "skipped"
          ? ` Dobropis: ${creditNote.reason ?? "přeskočen"}`
          : ` Dobropis se nepodařilo vystavit (${
              creditNote.reason ?? "neznámá chyba"
            }) — vystavte ho v iDokladu ručně.`
  const closeMessage = resolveNow
    ? " Žádost je vyřízená, zákazník dostal potvrzení."
    : ` Zbývá ${fmt(remainingAfter)}.`

  return {
    refunded: true,
    refund_id: refundId,
    method,
    amount,
    remaining: remainingAfter,
    status: updated.status,
    credit_note: creditNote,
    provider: confirmation,
    return_request: { ...updated, protocol_url: protocol.url ?? updated.protocol_url },
    message: `${baseMessage}${clampMessage}${depositNote}${creditMessage}${closeMessage}`,
    scope: refundScope,
    items: refundItems,
    lines,
  }
}
