import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  beginOrderEditOrderWorkflow,
  cancelBeginOrderEditWorkflow,
  confirmOrderEditRequestWorkflow,
  deleteOrderPaymentCollections,
  orderEditUpdateItemQuantityWorkflow,
} from "@medusajs/medusa/core-flows"
import { transitionMerchantOrderWorkflow } from "../../workflows/transition-merchant-order"
import { findOpenBalanceCollection } from "../balance-payment"
import { formatMoney } from "../customer-email"
import { cancelProductionStage } from "../production-cancel"
import {
  claimService,
  decisionOutcome,
  protocolRefundsOf,
  regenerateProtocol,
  retrieveClaim,
  sendResolvedEmail,
} from "./admin"
import { cancelOrderNatively } from "./cancel-order-action"
import { DEPOSIT_KEPT_NOTE_PREFIX } from "./case"
import { isClaimKind } from "./constants"
import { isMadeToOrderItem } from "./context"
import { loadClaimDetailOrder } from "./detail"
import { claimLineItemsOf } from "./line-items"
import { loadOrderRequests } from "./money"
import { buildClaimOrderItems } from "./order-items"
import {
  commissionPaidRemaining,
  depositRefundable,
  loadClaimProduction,
} from "./production"
import { MONEY_EPSILON, moneyState } from "./refund-rules"

/**
 * „Zrušit zakázku" ze žádosti — `POST /admin/return-requests/:id/cancel-production`
 * (docs/reklamace-a-zruseni.md §12.4).
 *
 * ## Pořadí a proč
 *
 * 1. Záloha musí být rozhodnutá: buď vrácená (`deposit_refunded` ≥ zaplaceno,
 *    přes „Vrátit zálohu" = refund `scope: "deposit"`), nebo majitelka výslovně
 *    zvolí „zálohu nevracet" (`keep_deposit: true`) — zapíše se do žádosti jako
 *    `resolution_note` „Záloha ponechána: …", ať je v protokolu i potvrzení.
 *    Zákazník na vrácení zálohy u zakázky nárok nemá (§1837 d), proto je to
 *    rozhodnutí, ne automat.
 * 2. Výrobní strana: fáze `cancelled`, nezaplacené žádosti o platbu zrušené
 *    (lib/production-cancel — totéž, co dělá „Zrušit zakázku" v modulu zakázek).
 * 3. Objednávka:
 *    - ČISTÁ zakázka (žádné běžné položky) → nativní zrušení + fáze fronty
 *      `cancelled` (`cancelOrderNatively`). ALE jen když na objednávce nezbývá
 *      nic zachyceného: `cancelOrderWorkflow` zachycené platby vrací SÁM a
 *      potichu, takže s ponechanou zálohou by „zálohu nevracet" prohrál o
 *      vteřinu později. S ponechanou zálohou se proto nativně neruší — fáze
 *      fronty je `cancelled`, objednávka v Medusa zůstává a hláška to řekne.
 *    - SMÍŠENÁ objednávka → zakázkové řádky se odeberou nativní úpravou
 *      objednávky (begin → množství 0 → confirm; workflow přímo, ne HTTP —
 *      stráž `blockMtoLineEdits` hlídá jen nativní admin routu a tady je to
 *      záměr, ne obcházení) a objednávka s běžnými položkami žije dál.
 *      Otevřená kolekce doplatku se smaže, jinak by brána odeslání držela
 *      běžné zboží na „čeká nezaplacená platba".
 * 4. Žádost: `resolution_note`; `resolved`, když už nic nečeká — čistá
 *    zakázka vždy, smíšená když nezbývá nic zachyceného nebo jsou vybrané
 *    běžné položky vrácené. Jinak zůstává otevřená (produkty se dořeší
 *    „Vrátit peníze za vybrané položky" / „Vyřízeno").
 */

export type CancelProductionBody = {
  /** „Zálohu nevracet" — výslovná volba majitelky, zapíše se do `resolution_note`. */
  keep_deposit?: boolean
  note?: string | null
}

export type CancelProductionResult = {
  cancelled: true
  /** Objednávka zrušená nativně (jen čistá zakázka s vrácenou zálohou). */
  order_cancelled: boolean
  /** Počet zakázkových řádků odebraných z objednávky (smíšená objednávka). */
  items_removed: number
  deposit: "refunded" | "kept" | "none"
  status: string
  return_request: any
  message: string
}

/**
 * Odebere řádky z objednávky nativní úpravou (begin → množství 0 → confirm).
 * Při chybě úpravu zruší, ať na objednávce nezůstane otevřená změna, která by
 * blokovala odeslání (brána: „probíhá úprava").
 */
const removeOrderLines = async (
  scope: MedusaContainer,
  order: { id: string },
  lineItemIds: string[],
  actor: string | null
): Promise<void> => {
  let started = false
  try {
    await beginOrderEditOrderWorkflow(scope).run({
      input: {
        order_id: order.id,
        created_by: actor ?? undefined,
        description: "Zrušení zakázky — odebrání zakázkové položky (Reklamace a zrušení)",
      } as never,
    })
    started = true
    await orderEditUpdateItemQuantityWorkflow(scope).run({
      input: {
        order_id: order.id,
        items: lineItemIds.map((id) => ({ id, quantity: 0 })),
      } as never,
    })
    await confirmOrderEditRequestWorkflow(scope).run({
      input: { order_id: order.id, confirmed_by: actor ?? undefined } as never,
    })
  } catch (error) {
    if (started) {
      await cancelBeginOrderEditWorkflow(scope)
        .run({ input: { order_id: order.id } as never })
        .catch(() => undefined)
    }
    throw error
  }
}

export const cancelProductionForClaim = async (
  scope: MedusaContainer,
  requestId: string,
  body: CancelProductionBody = {},
  actor: string | null = null
): Promise<CancelProductionResult> => {
  const request = await retrieveClaim(scope, requestId)

  if (!isClaimKind(request.kind)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Zakázku lze zrušit jen ze žádosti o odstoupení, vrácení zboží nebo reklamaci."
    )
  }
  if (request.status === "rejected" || request.status === "cancelled") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Žádost byla zamítnuta nebo stornována — zakázka se neruší."
    )
  }
  if (request.status === "pending") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Žádost napřed schvalte — zakázka se ruší až po rozhodnutí."
    )
  }

  const order = await loadClaimDetailOrder(scope, request.order_id)
  if (!order) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka k této žádosti nebyla nalezena."
    )
  }
  const production = await loadClaimProduction(scope, order.id)
  if (!production) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "K této objednávce není zakázková výroba — není co rušit."
    )
  }
  if (production.block.stage === "cancelled") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Zakázka už je zrušená.")
  }

  const currency = order.currency_code ?? "czk"
  const requests = await loadOrderRequests(scope, order.id)
  const state = moneyState(order, requests)
  const depositLeft = depositRefundable(production.block)
  const keepDeposit = body.keep_deposit === true

  if (depositLeft > MONEY_EPSILON && !keepDeposit) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Nejdřív rozhodněte o záloze ${formatMoney(depositLeft, currency)}: vraťte ji („Vrátit zálohu“), nebo výslovně zvolte „Zálohu nevracet“.`
    )
  }

  const userNote = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null
  const deposit: CancelProductionResult["deposit"] =
    depositLeft > MONEY_EPSILON
      ? "kept"
      : production.block.deposit_paid > MONEY_EPSILON
        ? "refunded"
        : "none"
  const depositText =
    deposit === "kept"
      ? `${DEPOSIT_KEPT_NOTE_PREFIX}: ${formatMoney(depositLeft, currency)}`
      : deposit === "refunded"
        ? "Záloha vrácena"
        : "Záloha nebyla zaplacena"
  const resolutionNote = [depositText, userNote].filter(Boolean).join(" — ")

  const items = ((order.items ?? []) as any[]).filter(Boolean)
  const madeToOrderIds = items
    .filter((item) => isMadeToOrderItem(item))
    .map((item) => item.id as string)
  const hasRegularItems = items.some((item) => !isMadeToOrderItem(item))

  const messages: string[] = []

  // 1) výrobní strana
  await cancelProductionStage(scope, {
    productionOrder: production.productionOrder,
    orderId: order.id,
  })
  messages.push(
    `Zakázka zrušena, výrobní příkaz uzavřen (${
      deposit === "kept" ? `záloha ${formatMoney(depositLeft, currency)} ponechána` : depositText.toLowerCase()
    }).`
  )

  // 2) objednávka
  let orderCancelled = false
  let itemsRemoved = 0
  if (!hasRegularItems) {
    if (state.remaining > MONEY_EPSILON) {
      // Pojistka §3: nativní zrušení by zachycené peníze (ponechanou zálohu)
      // vrátilo samo. Fáze fronty je „Zrušeno", objednávka v Medusa zůstává.
      await transitionMerchantOrderWorkflow(scope)
        .run({
          input: { order_id: order.id, stage: "cancelled", changed_by: actor, reconcile: true },
        })
        .catch(() => undefined)
      messages.push(
        `Objednávka #${order.display_id} zůstává v Medusa otevřená — nativní zrušení by ponechanou zálohu ${formatMoney(
          state.remaining,
          currency
        )} vrátilo. Ve frontě je „Zrušeno".`
      )
    } else {
      const result = await cancelOrderNatively(scope, order, actor)
      orderCancelled = result.cancelled
      messages.push(result.message)
    }
  } else {
    if (madeToOrderIds.length) {
      try {
        await removeOrderLines(scope, order, madeToOrderIds, actor)
        itemsRemoved = madeToOrderIds.length
        messages.push(
          `Zakázková položka odebrána z objednávky úpravou (${itemsRemoved} ${
            itemsRemoved === 1 ? "řádek" : "řádky"
          }), běžné položky zůstávají.`
        )
      } catch (error) {
        messages.push(
          `Zakázkovou položku se nepodařilo z objednávky odebrat (${
            error instanceof Error ? error.message : String(error)
          }) — odeberte ji ručně úpravou objednávky.`
        )
      }
    } else {
      messages.push("Objednávka zůstává — běžné položky jedou dál.")
    }
    // Otevřená výzva k doplatku zrušené zakázky by držela běžné zboží na
    // bráně odeslání („čeká nezaplacená platba").
    const openBalance = findOpenBalanceCollection(order)
    if (openBalance?.id) {
      await deleteOrderPaymentCollections(scope)
        .run({ input: { id: openBalance.id } as never })
        .then(() => messages.push("Otevřená výzva k doplatku zrušena."))
        .catch((error) =>
          messages.push(
            `Otevřenou výzvu k doplatku se nepodařilo zrušit (${
              error instanceof Error ? error.message : String(error)
            }).`
          )
        )
    }
  }

  // 3) žádost — vyřídit, když už nic nečeká.
  const detailItems = buildClaimOrderItems({
    order,
    requests,
    request,
    commissionPaidRemaining: commissionPaidRemaining(production.block),
  })
  const hasSelection = claimLineItemsOf(request.line_items).length > 0
  const regularPending = detailItems.some(
    (item) =>
      !item.is_made_to_order &&
      item.selected_in_claim > 0 &&
      item.refundable_quantity > 0 &&
      item.refundable_amount > MONEY_EPSILON
  )
  const resolveNow =
    request.status === "resolved" ||
    !hasRegularItems ||
    state.remaining <= MONEY_EPSILON ||
    (hasSelection && !regularPending)

  const now = new Date()
  const service = claimService(scope)
  const updated = await service.updateReturnRequests({
    id: request.id,
    resolution_note: resolutionNote,
    ...(resolveNow && request.status !== "resolved"
      ? {
          status: "resolved",
          resolved_at: now,
          resolution: request.resolution ?? "refund",
        }
      : {}),
  })

  if (resolveNow && request.status !== "resolved") {
    const protocol = await regenerateProtocol(scope, updated, {
      outcome: decisionOutcome(updated),
      note: resolutionNote,
      decidedAt: now,
      confirmation: true,
      refunds: protocolRefundsOf(updated, currency),
    })
    await sendResolvedEmail(scope, updated, {
      protocolUrl: protocol.url,
      currency,
      note: resolutionNote,
    })
    messages.push("Žádost je vyřízená, zákazník dostal potvrzení.")
  } else if (!resolveNow) {
    messages.push(
      "Žádost zůstává otevřená — zbývá vyřídit běžné položky (vrátit peníze za vybrané položky, nebo „Vyřízeno“)."
    )
  }

  return {
    cancelled: true,
    order_cancelled: orderCancelled,
    items_removed: itemsRemoved,
    deposit,
    status: updated.status,
    return_request: updated,
    message: messages.join(" "),
  }
}
