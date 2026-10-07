import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  createOrderPaymentCollectionWorkflow,
  createPaymentSessionsWorkflow,
  processPaymentWorkflow,
} from "@medusajs/medusa/core-flows"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"
import { orderConfirmedPath } from "./storefront-url"

/**
 * Getting a customer a link to pay what they still owe on a commission.
 *
 * There are two doors to this — she clicks „Požádat o doplatek" in the admin,
 * or the customer clicks „Doplatit" in an e-mail — and they must produce the
 * *same* link, not two. Two payment collections for one balance means the
 * customer can pay twice, and the second payment has nothing to attach to.
 *
 * So the reuse rules live here, once:
 *
 * 1. An open request that already has a link is returned as-is.
 * 2. Otherwise an open collection for the right amount is reused if one exists.
 * 3. Only then is anything new created, keyed by
 *    `balance:{production_order}:{amount}` so a retry lands on the same row.
 */

export const COMGATE_PROVIDER_ID = "pp_comgate_comgate"

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return toNumber(candidate.value ?? candidate.numeric_ ?? candidate.raw_ ?? 0)
  }
  return 0
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

export const paymentUrlFromSession = (session: any): string | null => {
  const data = session?.data || {}
  for (const key of ["redirectUrl", "redirect", "payment_url"]) {
    if (typeof data[key] === "string" && data[key].startsWith("https://")) {
      return data[key]
    }
  }
  return null
}

/** What the customer still owes, from the module's own snapshots. */
export const outstandingFor = (
  productionOrder: any,
  requests: any[]
): number => {
  const paid = requests
    .filter((request) => request?.status === "paid")
    .reduce((sum, request) => sum + toNumber(request.amount), 0)
  // Příplatek navyšuje, co zákazník dluží — doplatek ho tedy zahrnuje.
  const total =
    toNumber(productionOrder.agreed_total ?? productionOrder.original_total) +
    toNumber(productionOrder.surcharge)
  return roundMoney(Math.max(0, total - paid))
}

export type BalanceLinkResult = {
  /** `null` when nothing is owed. */
  payment_url: string | null
  outstanding: number
  request_id: string | null
  reused: boolean
}

/**
 * Returns a payable link for the outstanding balance, creating one only if
 * there is not already a usable one.
 */
export const ensureBalancePaymentLink = async (
  container: MedusaContainer,
  {
    order,
    productionOrder,
    method = "ALL",
  }: { order: any; productionOrder: any; method?: string }
): Promise<BalanceLinkResult> => {
  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const requests = (await madeToOrder.listProductionPaymentRequests({
    production_order_id: productionOrder.id,
  } as never)) as any[]

  const outstanding = outstandingFor(productionOrder, requests)

  if (outstanding <= 0.005) {
    return { payment_url: null, outstanding: 0, request_id: null, reused: true }
  }

  // 1 — a link that already exists and is still valid.
  //
  // Jen když sedí ČÁSTKA na aktuální nedoplatek. Bez téhle kontroly by příplatek
  // přidaný po vygenerování odkazu nechal zákazníka zaplatit starou (nižší)
  // sumu — doplatek by se „zaplatil", ale backend by dál chtěl zbytek. Když
  // částka nesedí, spadneme níž a vznikne odkaz na správnou (vyšší) částku pod
  // novým idempotency klíčem. (Reuse kolekce i admin „Požádat o doplatek"
  // částku kontrolují taky — tahle větev byla jediná, co ne.)
  const reusable = requests.find(
    (request) =>
      request.type === "balance" &&
      ["pending", "sent"].includes(request.status) &&
      request.payment_url &&
      Math.abs(toNumber(request.amount) - outstanding) <= 0.01
  )
  if (reusable) {
    return {
      payment_url: reusable.payment_url,
      outstanding,
      request_id: reusable.id,
      reused: true,
    }
  }

  // 2 — an open collection for this amount, so a half-finished attempt is
  // picked up rather than duplicated.
  const existingCollection = (order.payment_collections || []).find(
    (collection: any) =>
      ["not_paid", "awaiting"].includes(
        String(collection.status || "").toLowerCase()
      ) && Math.abs(toNumber(collection.amount) - outstanding) <= 0.01
  )

  const collection = existingCollection
    ? existingCollection
    : (
        await createOrderPaymentCollectionWorkflow(container).run({
          input: { order_id: order.id, amount: outstanding },
        })
      ).result[0]

  // 3 — the request row, keyed so a retry updates rather than duplicates.
  const idempotencyKey = `balance:${productionOrder.id}:${outstanding}`
  const previous = requests.find(
    (request) => request.idempotency_key === idempotencyKey
  )

  const request = previous
    ? await madeToOrder.updateProductionPaymentRequests({
        id: previous.id,
        status: "pending",
        create_state: "creating",
        payment_collection_id: collection.id,
        provider_error_reason: null,
      } as never)
    : await madeToOrder.createProductionPaymentRequests({
        type: "balance",
        status: "pending",
        amount: outstanding,
        currency_code: String(order.currency_code || "czk").toLowerCase(),
        payment_collection_id: collection.id,
        idempotency_key: idempotencyKey,
        create_state: "creating",
        production_order_id: productionOrder.id,
      } as never)

  try {
    const { result: session } = await createPaymentSessionsWorkflow(
      container
    ).run({
      input: {
        payment_collection_id: collection.id,
        provider_id: COMGATE_PROVIDER_ID,
        customer_id: order.customer_id || undefined,
        data: {
          method,
          email: order.email,
          country_code: "CZ",
          label: `Obj. ${order.display_id || "doplatek"}`.slice(0, 16),
          name: `Doplatek objednávky ${order.display_id || order.id}`,
          lang: "cs",
          production_payment_request_id: (request as any).id,
          // Návrat z ComGate po doplatku na reálnou stránku objednávky, ne na
          // neexistující /payment/{session}/confirmed (to byl ten 404).
          url_paid: orderConfirmedPath(order.id, "paid"),
          url_cancelled: orderConfirmedPath(order.id, "zruseno"),
          url_pending: orderConfirmedPath(order.id, "ceka"),
        },
      },
    })

    const paymentUrl = paymentUrlFromSession(session)
    if (!paymentUrl) {
      throw new Error("ComGate nevrátil platební odkaz.")
    }

    await madeToOrder.updateProductionPaymentRequests({
      id: (request as any).id,
      payment_session_id: (session as any)?.id ?? null,
      payment_url: paymentUrl,
      // KLÍČOVÉ: bez `provider_transaction_id` 30min záchranná úloha doplatek
      // přeskočí (bere jen požadavky, co ho mají — stejně jako záloha a admin
      // „Požádat o doplatek"). Když tedy webhook nedorazí, doplatek by „zmizel".
      // ComGate ho vrací v `session.data.transId`.
      provider_transaction_id:
        (session as any)?.data?.transId ?? (session as any)?.data?.id ?? null,
      create_state: "created",
      status: "pending",
    } as never)

    return {
      payment_url: paymentUrl,
      outstanding,
      request_id: (request as any).id,
      reused: false,
    }
  } catch (error) {
    // The row stays, marked failed with the reason, so a retry can see what
    // happened rather than starting from nothing.
    await madeToOrder
      .updateProductionPaymentRequests({
        id: (request as any).id,
        create_state: "failed",
        provider_error_reason:
          error instanceof Error ? error.message : "Neznámá chyba.",
      } as never)
      .catch(() => undefined)

    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Platební odkaz se nepodařilo vytvořit: ${
        error instanceof Error ? error.message : "neznámá chyba"
      }`
    )
  }
}

export type BalanceReconcileResult = {
  /** "paid" = právě dorovnáno/už zaplaceno, "pending" = brána ještě nepotvrdila,
   *  "failed" = zrušeno/vypršelo, "none" = není co dorovnávat. */
  status: "paid" | "pending" | "failed" | "none"
  request_id: string | null
}

/**
 * Dorovnání doplatku PO NÁVRATU z ComGate — „storefront-complete" krok, který
 * doplatku chyběl (záloha ho má v checkoutu). Zeptá se brány na stav otevřené
 * žádosti o doplatek a při zaplacení: zaúčtuje nativní platbu, označí žádost
 * jako zaplacenou, posune fázi na „připraveno" a emituje `made-to-order.balance-paid`
 * (= potvrzení zákazníkovi + doplatková faktura, obojí visí na tom eventu).
 *
 * Nezávislé na webhooku (ten potřebuje notif. URL v portálu ČP/ComGate) i na
 * 30min jobu — tentýž výsledek, hned po návratu z platby. Idempotentní: bere jen
 * žádosti ve stavu pending/sent a `onBalancePaid` dedupuje e-mail i fakturu, takže
 * pozdní webhook/job to nezdvojí. Reflektuje jen to, co brána potvrdí — nic nehádá.
 */
export const reconcileOrderBalance = async (
  container: MedusaContainer,
  orderId: string
): Promise<BalanceReconcileResult> => {
  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const [productionOrder] = (await madeToOrder.listProductionOrders({
    order_id: orderId,
  } as never)) as any[]
  if (!productionOrder) {
    return { status: "none", request_id: null }
  }

  const requests = (await madeToOrder.listProductionPaymentRequests({
    production_order_id: productionOrder.id,
  } as never)) as any[]
  const request = requests.find(
    (r) =>
      r.type === "balance" &&
      ["pending", "sent"].includes(r.status) &&
      r.payment_session_id
  )
  if (!request) {
    return { status: "none", request_id: null }
  }

  const paymentModule = container.resolve(Modules.PAYMENT)
  const [session] = await paymentModule.listPaymentSessions({
    id: request.payment_session_id,
  } as never)
  if (!session) {
    return { status: "pending", request_id: request.id }
  }

  let status = ""
  try {
    const provider = container.resolve(
      `pp_${(session as any).provider_id ?? ""}`.replace(/^pp_pp_/, "pp_")
    ) as any
    const result = await provider.getPaymentStatus({
      data: (session as any).data ?? {},
    })
    status = String(result?.status ?? "").toLowerCase()
  } catch (error) {
    logger.warn(
      `[balance] Stav doplatku ${request.id} se při návratu nepodařilo ověřit: ${
        error instanceof Error ? error.message : "neznámá chyba"
      }`
    )
    return { status: "pending", request_id: request.id }
  }

  const now = new Date()

  if (status === "captured" || status === "authorized") {
    // 1 — zaúčtovat NATIVNÍ platbu. Relace doplatku byla jen VYTVOŘENÁ, ne
    //     autorizovaná, takže v kolekci žádný `Payment` ještě není — hledat
    //     ho a volat `capturePaymentWorkflow` nemělo co zachytit a kolekce
    //     zůstávala `not_paid`. `processPaymentWorkflow` s `captured` relaci
    //     autorizuje do platby A zachytí (stejná cesta jako ověřený webhook
    //     i dohled u checkoutu). Kolekce doplatku není navázaná na košík, tak
    //     se nespouští dokončení košíku. Best-effort — produkční strana níž
    //     nese fakturu i e-mail.
    try {
      await processPaymentWorkflow(container).run({
        input: {
          action: "captured",
          data: {
            session_id: request.payment_session_id,
            amount: request.amount,
          },
        } as never,
      })
    } catch (error) {
      logger.warn(
        `[balance] Nativní zaúčtování doplatku ${request.id} se nepodařilo: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    }

    // 2 — produkční strana: žádost zaplacena + fáze „připraveno".
    await madeToOrder.updateProductionPaymentRequests({
      id: request.id,
      status: "paid",
      provider_status: "PAID",
      paid_at: request.paid_at || now,
      last_checked_at: now,
    } as never)
    if (
      !["completed", "cancelled", "ready_to_ship"].includes(
        productionOrder.stage
      )
    ) {
      await madeToOrder.updateProductionOrders({
        id: productionOrder.id,
        stage: "ready_to_ship",
        ready_to_ship_at: productionOrder.ready_to_ship_at || now,
      } as never)
    }

    // 3 — potvrzení zákazníkovi + doplatková faktura (customer-emails onBalancePaid).
    await container.resolve(Modules.EVENT_BUS).emit({
      name: "made-to-order.balance-paid",
      data: {
        order_id: orderId,
        production_order_id: productionOrder.id,
        payment_request_id: request.id,
        amount: request.amount,
        currency_code: request.currency_code,
      },
    })

    logger.info(
      `[balance] Doplatek ${request.id} dorovnán po návratu z brány (objednávka ${orderId}).`
    )
    return { status: "paid", request_id: request.id }
  }

  if (["canceled", "cancelled", "error", "expired"].includes(status)) {
    await madeToOrder.updateProductionPaymentRequests({
      id: request.id,
      status: "expired",
      provider_status: status.toUpperCase(),
      last_checked_at: now,
    } as never)
    return { status: "failed", request_id: request.id }
  }

  return { status: "pending", request_id: request.id }
}
