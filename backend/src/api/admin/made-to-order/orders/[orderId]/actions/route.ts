import {
  beginOrderEditOrderWorkflow,
  cancelBeginOrderEditWorkflow,
  confirmOrderEditRequestWorkflow,
  createOrderPaymentCollectionWorkflow,
  createPaymentSessionsWorkflow,
  orderEditUpdateItemQuantityWorkflow,
  requestOrderEditRequestWorkflow,
} from "@medusajs/medusa/core-flows"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import type { IEventBusModuleService } from "@medusajs/framework/types"
import { MADE_TO_ORDER_MODULE } from "../../../../../../modules/made-to-order"
import MadeToOrderModuleService from "../../../../../../modules/made-to-order/service"
import type { MerchantOrderStage } from "../../../../../../modules/merchant-order/stages"
import { transitionMerchantOrderWorkflow } from "../../../../../../workflows/transition-merchant-order"

type ProductionAction =
  | "confirm_specification"
  | "start_production"
  | "complete_production"
  | "request_balance"
  | "remind_balance"
  | "announce_delay"
  | "cancel"

type ActionBody = {
  action: ProductionAction
  agreed_total?: number
  internal_note?: string | null
  estimated_completion_at?: string | null
  /** announce_delay: shown to the customer in the delay e-mail. */
  delay_reason?: string | null
  method?: string
}

const COMGATE_PROVIDER_ID = "pp_comgate_comgate"

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>
    return Number(source.value ?? source.numeric_ ?? source.raw ?? 0)
  }
  return Number(value ?? 0)
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const requireStage = (stage: string, allowed: string[]) => {
  if (!allowed.includes(stage)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Tato akce není v aktuálním stavu zakázky dostupná."
    )
  }
}

/**
 * Production milestones move the merchant queue through the same workflow the queue
 * itself uses, instead of writing `merchant_order_state` directly.
 *
 * The previous inline version bypassed the distributed lock, the transition guard and
 * the compensation handler, so a production action could leave the queue in a stage the
 * merchant UI considers unreachable. `reconcile: true` is set because these are
 * consequences of a production step, not merchant stage clicks.
 */
const setMerchantStage = async (
  req: MedusaRequest,
  orderId: string,
  stage: MerchantOrderStage
) => {
  const { result } = await transitionMerchantOrderWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      stage,
      changed_by: (req as any).auth_context?.actor_id || null,
      reconcile: true,
    },
  })
  return result
}

const loadOrder = async (req: MedusaRequest) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "customer_id",
      "currency_code",
      "total",
      "items.id",
      "items.quantity",
      "items.unit_price",
      "items.metadata",
      "payment_collections.id",
      "payment_collections.amount",
      "payment_collections.status",
      "payment_collections.metadata",
      "payment_collections.payment_sessions.*",
    ],
    filters: { id: req.params.orderId },
  })
  if (!orders[0]) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }
  return orders[0] as any
}

const adjustNativeOrderTotal = async (
  req: MedusaRequest,
  order: any,
  requestedTotal: number
) => {
  const currentTotal = toNumber(order.total)
  const delta = roundMoney(requestedTotal - currentTotal)
  if (Math.abs(delta) <= 0.005) return currentTotal

  const snapshotCollection = (order.payment_collections || []).find(
    (collection: any) => collection?.metadata?.made_to_order
  )
  const productionLineIds = new Set(
    Array.isArray(snapshotCollection?.metadata?.production_lines)
      ? snapshotCollection.metadata.production_lines.map(
          (line: any) => line.line_item_id
        )
      : []
  )
  const item = (order.items || []).find((candidate: any) =>
    productionLineIds.has(candidate.id)
  )

  if (!item) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "V objednávce chybí řádek zakázkové výroby pro úpravu ceny."
    )
  }

  const quantity = Math.max(1, toNumber(item.quantity))
  const unitPrice = toNumber(item.unit_price)
  const nextUnitPrice = roundMoney(unitPrice + delta / quantity)
  if (nextUnitPrice < 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Domluvená cena by vytvořila zápornou cenu produktu."
    )
  }

  let editStarted = false
  try {
    await beginOrderEditOrderWorkflow(req.scope).run({
      input: {
        order_id: order.id,
        created_by: (req as any).auth_context?.actor_id,
        description: "Upřesnění konečné ceny zakázkové výroby",
      },
    })
    editStarted = true
    await orderEditUpdateItemQuantityWorkflow(req.scope).run({
      input: {
        order_id: order.id,
        items: [
          {
            id: item.id,
            quantity,
            unit_price: nextUnitPrice,
            metadata: item.metadata || {},
          },
        ],
      },
    })
    await requestOrderEditRequestWorkflow(req.scope).run({
      input: {
        order_id: order.id,
        requested_by: (req as any).auth_context?.actor_id,
      },
    })
    await confirmOrderEditRequestWorkflow(req.scope).run({
      input: {
        order_id: order.id,
        confirmed_by: (req as any).auth_context?.actor_id,
      },
    })
  } catch (error) {
    if (editStarted) {
      await cancelBeginOrderEditWorkflow(req.scope)
        .run({ input: { order_id: order.id } })
        .catch(() => undefined)
    }
    throw error
  }

  const refreshed = await loadOrder(req)
  return toNumber(refreshed.total)
}

const paymentUrlFromSession = (session: any): string | null => {
  const data = session?.data || {}
  for (const key of ["redirectUrl", "redirect", "payment_url"]) {
    if (typeof data[key] === "string" && data[key].startsWith("https://")) {
      return data[key]
    }
  }
  return null
}

export const POST = async (
  req: MedusaRequest<ActionBody>,
  res: MedusaResponse
) => {
  const body = req.body || ({} as ActionBody)
  const actions: ProductionAction[] = [
    "confirm_specification",
    "start_production",
    "complete_production",
    "request_balance",
    // P6-5. Deliberately a *manual* action with no scheduled counterpart: D4
    // says nothing chases a customer on its own, so the only reminder that ever
    // goes out is one she chose to send.
    "remind_balance",
    "announce_delay",
    "cancel",
  ]
  if (!actions.includes(body.action)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Neplatná akce zakázky.")
  }

  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const eventBus = req.scope.resolve<IEventBusModuleService>(Modules.EVENT_BUS)
  const productionOrders = await madeToOrder.listProductionOrders({
    order_id: req.params.orderId,
  })
  let productionOrder: any = productionOrders[0]
  if (!productionOrder) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Zakázková výroba nebyla pro tuto objednávku nalezena."
    )
  }

  const now = new Date()
  if (body.action === "confirm_specification") {
    requireStage(productionOrder.stage, ["specification_pending"])
    const requestedTotal = Number(body.agreed_total)
    if (!Number.isFinite(requestedTotal) || requestedTotal <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Domluvená celková cena musí být vyšší než nula."
      )
    }

    // P6-2. The deposit is already in the bank; agreeing a price below it would
    // leave the shop owing money the moment the specification is confirmed,
    // which is a refund conversation and not something to stumble into by
    // typing a number. The card warns about this too, but the check has to live
    // here — the card is not the only way to reach this route.
    const paidSoFar = (
      await madeToOrder.listProductionPaymentRequests({
        production_order_id: productionOrder.id,
      } as any)
    )
      .filter((payment: any) => payment.status === "paid")
      .reduce((sum: number, payment: any) => sum + toNumber(payment.amount), 0)

    if (requestedTotal < paidSoFar - 0.005) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Cena nemůže být nižší než už zaplacená záloha (${roundMoney(paidSoFar)}). ` +
          `Přeplatek vraťte v detailu objednávky.`
      )
    }

    // Dates: a deadline in the past is always a typo, and it would immediately
    // show the commission as overdue on Přehled.
    if (body.estimated_completion_at) {
      const deadline = new Date(body.estimated_completion_at)
      if (Number.isNaN(deadline.getTime())) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Termín dokončení není platné datum."
        )
      }
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      if (deadline.getTime() < startOfToday.getTime()) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Termín dokončení nemůže být v minulosti."
        )
      }
    }
    const order = await loadOrder(req)
    const finalTotal = await adjustNativeOrderTotal(req, order, requestedTotal)
    productionOrder = await madeToOrder.updateProductionOrders({
      id: productionOrder.id,
      stage: "confirmed",
      agreed_total: finalTotal,
      final_total_confirmed_at: now,
      specification_confirmed_at: now,
      estimated_completion_at: body.estimated_completion_at
        ? new Date(body.estimated_completion_at)
        : productionOrder.estimated_completion_at,
      internal_note: body.internal_note?.trim() || productionOrder.internal_note,
    })
    await setMerchantStage(req, req.params.orderId, "working")
    // §16 #6 — the customer agreed a price and a piece is now being made for
    // them. Emitted rather than sent inline so a mail problem cannot fail the
    // Order Edit chain that just adjusted the money.
    await eventBus.emit({
      name: "made-to-order.specification-confirmed",
      data: {
        order_id: req.params.orderId,
        production_order_id: productionOrder.id,
      },
    })
  }

  if (body.action === "start_production") {
    requireStage(productionOrder.stage, ["confirmed"])
    productionOrder = await madeToOrder.updateProductionOrders({
      id: productionOrder.id,
      stage: "in_production",
      production_started_at: now,
    })
    await setMerchantStage(req, req.params.orderId, "working")
  }

  if (body.action === "complete_production") {
    requireStage(productionOrder.stage, ["in_production"])
    const payments = await madeToOrder.listProductionPaymentRequests({
      production_order_id: productionOrder.id,
    } as any)
    const paid = payments
      .filter((payment: any) => payment.status === "paid")
      .reduce((sum: number, payment: any) => sum + toNumber(payment.amount), 0)
    const total = toNumber(
      productionOrder.agreed_total ?? productionOrder.original_total
    )
    const fullyPaid = paid >= total - 0.005
    productionOrder = await madeToOrder.updateProductionOrders({
      id: productionOrder.id,
      stage: fullyPaid ? "ready_to_ship" : "awaiting_balance",
      production_completed_at: now,
      ready_to_ship_at: fullyPaid ? now : null,
    })
  }

  if (body.action === "announce_delay") {
    // Any stage where a promised date can still slip. Terminal stages and the
    // pre-confirmation stage (no date was promised yet) are excluded.
    requireStage(productionOrder.stage, [
      "confirmed",
      "in_production",
      "awaiting_balance",
    ])

    if (!body.estimated_completion_at) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Nový termín dokončení je povinný."
      )
    }
    const newDeadline = new Date(body.estimated_completion_at)
    if (Number.isNaN(newDeadline.getTime())) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Nový termín dokončení není platné datum."
      )
    }
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    if (newDeadline.getTime() < startOfToday.getTime()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Nový termín dokončení nemůže být v minulosti."
      )
    }

    const originalDeadline = productionOrder.estimated_completion_at
      ? new Date(productionOrder.estimated_completion_at)
      : null

    productionOrder = await madeToOrder.updateProductionOrders({
      id: productionOrder.id,
      estimated_completion_at: newDeadline,
    })

    // The customer e-mail (§16 „Výroba se protáhne") hangs off this event.
    // Emitted rather than sent inline so a mail problem cannot fail the date
    // change she just saved — same reasoning as specification-confirmed.
    await eventBus.emit({
      name: "made-to-order.delay-announced",
      data: {
        order_id: req.params.orderId,
        production_order_id: productionOrder.id,
        original_completion_at: originalDeadline?.toISOString() ?? null,
        new_completion_at: newDeadline.toISOString(),
        reason: body.delay_reason?.trim() || null,
      },
    })
  }

  if (body.action === "request_balance") {
    requireStage(productionOrder.stage, ["awaiting_balance"])
    const order = await loadOrder(req)
    const payments = await madeToOrder.listProductionPaymentRequests({
      production_order_id: productionOrder.id,
    } as any)
    const paid = payments
      .filter((payment: any) => payment.status === "paid")
      .reduce((sum: number, payment: any) => sum + toNumber(payment.amount), 0)
    const total = toNumber(
      productionOrder.agreed_total ?? productionOrder.original_total
    )
    const outstanding = roundMoney(Math.max(0, total - paid))

    if (outstanding <= 0.005) {
      productionOrder = await madeToOrder.updateProductionOrders({
        id: productionOrder.id,
        stage: "ready_to_ship",
        ready_to_ship_at: now,
      })
    } else {
      const reusable = payments.find(
        (payment: any) =>
          payment.type === "balance" &&
          ["pending", "sent"].includes(payment.status) &&
          payment.payment_url
      ) as any

      if (reusable) {
        await eventBus.emit({
          name: "made-to-order.balance-requested",
          data: {
            order_id: order.id,
            payment_request_id: reusable.id,
          },
        })
        await madeToOrder.updateProductionPaymentRequests({
          id: reusable.id,
          status: "sent",
          sent_at: now,
        })
      } else {
        const existingCollection = (order.payment_collections || []).find(
          (collection: any) =>
            ["not_paid", "awaiting"].includes(
              String(collection.status || "").toLowerCase()
            ) &&
            Math.abs(toNumber(collection.amount) - outstanding) <= 0.01
        )
        const collection = existingCollection
          ? existingCollection
          : (
              await createOrderPaymentCollectionWorkflow(req.scope).run({
                input: { order_id: order.id, amount: outstanding },
              })
            ).result[0]

        const idempotencyKey = `balance:${productionOrder.id}:${outstanding}`
        const previous = payments.find(
          (payment: any) => payment.idempotency_key === idempotencyKey
        ) as any
        const request = previous
          ? await madeToOrder.updateProductionPaymentRequests({
              id: previous.id,
              status: "pending",
              create_state: "creating",
              payment_collection_id: collection.id,
              provider_error_reason: null,
            })
          : await madeToOrder.createProductionPaymentRequests({
              type: "balance",
              status: "pending",
              amount: outstanding,
              currency_code: String(order.currency_code || "czk").toLowerCase(),
              payment_collection_id: collection.id,
              idempotency_key: idempotencyKey,
              create_state: "creating",
              production_order_id: productionOrder.id,
            } as any)

        try {
          const { result: session } = await createPaymentSessionsWorkflow(
            req.scope
          ).run({
            input: {
              payment_collection_id: collection.id,
              provider_id: COMGATE_PROVIDER_ID,
              customer_id: order.customer_id || undefined,
              data: {
                method: body.method || "ALL",
                email: order.email,
                country_code: "CZ",
                label: `Obj. ${order.display_id || "doplatek"}`.slice(0, 16),
                name: `Doplatek objednávky ${order.display_id || order.id}`,
                lang: "cs",
                production_payment_request_id: request.id,
              },
            },
          })
          const paymentUrl = paymentUrlFromSession(session)
          if (!paymentUrl) {
            throw new Error("ComGate nevrátil platební odkaz.")
          }
          const providerData = (session as any).data || {}
          await madeToOrder.updateProductionPaymentRequests({
            id: request.id,
            status: "sent",
            create_state: "created",
            payment_session_id: (session as any).id,
            provider_transaction_id:
              providerData.transId || providerData.id || null,
            payment_url: paymentUrl,
            selected_method: providerData.method || body.method || "ALL",
            provider_status: providerData.providerStatus || "PENDING",
            sent_at: now,
            last_checked_at: now,
          })
          await eventBus.emit({
            name: "made-to-order.balance-requested",
            data: { order_id: order.id, payment_request_id: request.id },
          })
          productionOrder = await madeToOrder.updateProductionOrders({
            id: productionOrder.id,
            balance_requested_at: now,
          })
        } catch (error) {
          await madeToOrder.updateProductionPaymentRequests({
            id: request.id,
            status: "failed",
            create_state: "unknown",
            provider_error_reason:
              error instanceof Error ? error.message : "Neznámá chyba ComGate",
            last_checked_at: now,
          })
          await setMerchantStage(
            req,
            req.params.orderId,
            "payment_problem"
          )
          throw error
        }
      }
    }
  }

  if (body.action === "remind_balance") {
    requireStage(productionOrder.stage, ["awaiting_balance"])
    const payments = await madeToOrder.listProductionPaymentRequests({
      production_order_id: productionOrder.id,
    } as any)

    const open = payments.find(
      (payment: any) =>
        payment.type === "balance" &&
        ["pending", "sent"].includes(payment.status)
    ) as any

    if (!open) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Není o co připomínat — u zakázky není otevřená žádost o doplatek."
      )
    }

    // The same request, therefore the same e-mail dedupe key: a reminder is a
    // re-send of one link, not a second demand for money. The subscriber's key
    // is `paylink:{request}`, so the notification module recognises this and
    // does not deliver twice — which is the behaviour the confirm dialog
    // promises her.
    const eventBus2 = req.scope.resolve<IEventBusModuleService>(Modules.EVENT_BUS)
    await eventBus2.emit({
      name: "made-to-order.balance-requested",
      data: { order_id: req.params.orderId, payment_request_id: open.id },
    })

    productionOrder = await madeToOrder.updateProductionPaymentRequests({
      id: open.id,
      status: "sent",
      sent_at: now,
      notification_sent_at: now,
    } as any)

    res.status(200).json({ reminded: true, payment_url: open.payment_url ?? null })
    return
  }

  if (body.action === "cancel") {
    requireStage(productionOrder.stage, [
      "specification_pending",
      "confirmed",
      "in_production",
      "awaiting_balance",
    ])
    productionOrder = await madeToOrder.updateProductionOrders({
      id: productionOrder.id,
      stage: "cancelled",
    })
    const payments = await madeToOrder.listProductionPaymentRequests({
      production_order_id: productionOrder.id,
    } as any)
    for (const payment of payments.filter((item: any) => item.status !== "paid")) {
      await madeToOrder.updateProductionPaymentRequests({
        id: payment.id,
        status: "cancelled",
      })
    }
    await setMerchantStage(req, req.params.orderId, "cancelled")
    await eventBus.emit({
      name: "made-to-order.cancelled",
      data: { order_id: req.params.orderId, production_order_id: productionOrder.id },
    })
  }

  res.status(200).json({ production_order: productionOrder })
}

