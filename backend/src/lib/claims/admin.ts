import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  formatDate,
  formatMoney,
  orderLink,
  sendCustomerEmail,
} from "../customer-email"
import { orderClaimsUrl } from "../order-access-link"
import {
  buildAndStoreProtocol,
  protocolNumberFor,
  type ProtocolRefund,
} from "../reklamacni-protokol"
import { RETURN_REQUEST_MODULE } from "../../modules/return-request"
import type ReturnRequestModuleService from "../../modules/return-request/service"
import { damageCauseLabel, resolutionLabel } from "./constants"
import { claimItemsText, suggestedRefundAmount } from "./line-items"
import { goodsShipped, MONEY_STATE_FIELDS } from "./money"
import {
  moneyState,
  requestRefundedTotal,
  requestRefunds,
} from "./refund-rules"

/**
 * Společné kusy admin rout modulu „Reklamace a zrušení"
 * (`api/admin/return-requests/**`): načtení žádosti, regenerace protokolu,
 * základ dat pro e-maily, dopočet peněz do seznamu. Routy jsou pak jen
 * pravidla + pořadí kroků.
 */

export const claimService = (container: MedusaContainer) =>
  container.resolve<ReturnRequestModuleService>(RETURN_REQUEST_MODULE)

export const retrieveClaim = async (
  container: MedusaContainer,
  id: string
): Promise<any> => {
  try {
    return await claimService(container).retrieveReturnRequest(id)
  } catch {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Žádost o reklamaci / vrácení nebyla nalezena."
    )
  }
}

export const refundMethodLabel = (method: unknown): string =>
  method === "comgate" ? "na platební kartu" : "ručně (hotově / převodem)"

/** Refundace žádosti ve tvaru pro protokol. */
export const protocolRefundsOf = (
  request: any,
  currency: string | null | undefined
): ProtocolRefund[] =>
  requestRefunds(request).map((refund) => ({
    amount: refund.amount,
    currency: String(currency || "czk"),
    method: refund.method,
    at: refund.at ? new Date(refund.at) : new Date(),
    note: refund.note ?? null,
  }))

/** „Schváleno — oprava" / „Zamítnuto" / „Žádost stornována" — do protokolu. */
export const decisionOutcome = (
  request: { status?: string | null; resolution?: string | null },
  status: string | null = null
): string => {
  const effective = status ?? request.status ?? ""
  if (effective === "rejected") return "Zamítnuto"
  if (effective === "cancelled") return "Žádost stornována"
  const label = resolutionLabel(request.resolution)
  return label ? `Schváleno — ${label}` : "Schváleno"
}

export type RegenerateProtocolOptions = {
  outcome: string
  note?: string | null
  decidedAt: Date
  /** „Potvrzení o vyřízení" (§19/3 ZOS) místo potvrzení o uplatnění s rozhodnutím. */
  confirmation?: boolean
  refunds?: ProtocolRefund[]
}

/**
 * Přegeneruje protokol se stavem vyřízení a uloží nový odkaz na žádost.
 * Číslo zůstává (jedno číslo na žádost, PDF jen roste o vyřízení). Chyba
 * úložiště nic neshodí — odkaz prostě zůstane ten starý.
 */
export const regenerateProtocol = async (
  container: MedusaContainer,
  request: any,
  options: RegenerateProtocolOptions
): Promise<{ url: string | null; number: string }> => {
  const createdAt = request.created_at
    ? new Date(request.created_at)
    : options.decidedAt
  const number: string =
    request.protocol_number ||
    protocolNumberFor(request.kind ?? null, request.order_display_id, createdAt)

  const protocol = await buildAndStoreProtocol(container, {
    protocolNumber: number,
    kind: request.kind ?? null,
    orderDisplayId: request.order_display_id,
    customerName: request.customer_name ?? null,
    email: request.email,
    createdAt,
    reason: request.reason,
    // Položky přednostně z `line_items` (název · varianta · ks · částka), u
    // starých řádků text zákazníka (§11.5).
    items: claimItemsText(request),
    damageCause: damageCauseLabel(request.damage_cause),
    requestedResolution:
      request.kind === "reklamace"
        ? resolutionLabel(request.requested_resolution) || null
        : null,
    resolution: {
      outcome: options.outcome,
      note: options.note ?? null,
      decidedAt: options.decidedAt,
    },
    refunds: options.refunds ?? [],
    confirmation: options.confirmation ?? false,
  }).catch(() => ({ url: null as string | null, number }))

  if (protocol.url) {
    await claimService(container)
      .updateReturnRequests({
        id: request.id,
        protocol_url: protocol.url,
        protocol_number: protocol.number,
      })
      .catch(() => undefined)
  }
  return protocol
}

/**
 * Společný základ `data` pro e-maily modulu — jen reálné hodnoty, žádné výplně.
 * `items` = položky slovy (přednostně `line_items`), `carrierDamage` = věta
 * „Poškozeno přepravou" v šablonách, které ji umí (§11.3, §11.5).
 */
export const claimEmailBase = (
  request: any,
  protocolUrl?: string | null
): Record<string, unknown> => {
  const link = orderLink({ id: request.order_id })
  const claimsUrl = orderClaimsUrl(request.order_id)
  const label = resolutionLabel(request.resolution)
  const items = claimItemsText(request)
  return {
    ...(request.customer_name ? { customerName: request.customer_name } : {}),
    orderNumber: `#${request.order_display_id}`,
    kind: request.kind ?? null,
    resolution: request.resolution ?? null,
    ...(label ? { resolutionLabel: label } : {}),
    ...(items ? { items } : {}),
    ...(request.damage_cause === "carrier" ? { carrierDamage: true } : {}),
    ...(link ? { orderLink: link } : {}),
    ...(claimsUrl ? { claimsUrl } : {}),
    ...(protocolUrl ? { protocolUrl } : {}),
  }
}

/**
 * „Potvrzení o vyřízení" — JEDINÝ e-mail za uzavření žádosti, ať skončila
 * refundací, opravou nebo výměnou. Volá ho `resolve` i poslední `refund`.
 */
export const sendResolvedEmail = async (
  container: MedusaContainer,
  request: any,
  options: { protocolUrl?: string | null; currency?: string | null; note?: string | null }
): Promise<void> => {
  const total = requestRefundedTotal(request)
  await sendCustomerEmail(container, {
    template: "return-resolved",
    to: request.email,
    key: `return-resolved:${request.id}`,
    orderId: request.order_id,
    data: {
      subject:
        request.kind === "reklamace"
          ? "Reklamace vyřízena — potvrzení"
          : "Vrácení vyřízeno — potvrzení",
      ...claimEmailBase(request, options.protocolUrl),
      resolvedAt: formatDate(request.resolved_at ?? new Date()),
      ...(total > 0
        ? {
            refundAmount: formatMoney(total, options.currency ?? "czk"),
            refundMethod: refundMethodLabel(request.refund_method),
          }
        : {}),
      ...(options.note ? { note: options.note } : {}),
    },
  })
}

/**
 * Dopočet `captured_total` / `refunded_total` / `remaining` ke každému řádku
 * seznamu — z plateb objednávky a ze VŠECH žádostí k ní (sourozenci se počítají
 * do „vráceno" taky). Jeden dotaz na objednávky, jeden na sourozence.
 *
 * `suggested_amount` (§11.2) = výchozí částka pro „Vrátit peníze": s položkami
 * `min(remaining, Σ line_items.total)`, bez položek `remaining`.
 */
export const enrichWithMoney = async (
  container: MedusaContainer,
  requests: any[]
): Promise<any[]> => {
  const orderIds = [
    ...new Set(requests.map((request) => request.order_id).filter(Boolean)),
  ] as string[]
  if (!orderIds.length) {
    return requests.map((request) => ({
      ...request,
      captured_total: 0,
      refunded_total: 0,
      remaining: 0,
      suggested_amount: 0,
    }))
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query
    .graph({
      entity: "order",
      fields: MONEY_STATE_FIELDS,
      filters: { id: orderIds },
    })
    .catch(() => ({ data: [] as any[] }))
  const byOrder = new Map((orders as any[]).map((order) => [order.id, order]))

  const siblings = (await claimService(container)
    .listReturnRequests({ order_id: orderIds } as never)
    .catch(() => [])) as any[]
  const siblingsByOrder = new Map<string, any[]>()
  for (const sibling of siblings) {
    const list = siblingsByOrder.get(sibling.order_id) ?? []
    list.push(sibling)
    siblingsByOrder.set(sibling.order_id, list)
  }

  return requests.map((request) => {
    const order = byOrder.get(request.order_id)
    const state = order
      ? moneyState(order, siblingsByOrder.get(request.order_id) ?? [request])
      : { captured: 0, refunded: 0, remaining: 0 }
    return {
      ...request,
      currency_code: order?.currency_code ?? "czk",
      captured_total: state.captured,
      refunded_total: state.refunded,
      remaining: state.remaining,
      suggested_amount: suggestedRefundAmount(state.remaining, request.line_items),
      // Odstoupení před odesláním: zboží nikdy neodešlo → nic se nevrací,
      // refundace jde rovnou a nabízí se zrušení objednávky.
      goods_shipped: order ? goodsShipped(order) : false,
    }
  })
}
