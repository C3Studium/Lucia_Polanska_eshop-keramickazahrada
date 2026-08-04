import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  createOrderPaymentCollectionWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"

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
  const total = toNumber(
    productionOrder.agreed_total ?? productionOrder.original_total
  )
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
  const reusable = requests.find(
    (request) =>
      request.type === "balance" &&
      ["pending", "sent"].includes(request.status) &&
      request.payment_url
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
