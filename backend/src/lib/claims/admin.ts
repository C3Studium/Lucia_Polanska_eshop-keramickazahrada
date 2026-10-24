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
import { planClaimCase } from "./case"
import { damageCauseSentence, resolutionLabel } from "./constants"
import { CLAIM_FLAG_ORDER_FIELDS, claimFlagsOf } from "./flags"
import { claimItemsText, suggestedRefundAmount } from "./line-items"
import { goodsShipped, MONEY_STATE_FIELDS } from "./money"
import { productionBlockOf } from "./production"
import { refundLineText, requestRefundLinesText } from "./refund-lines"
import { storedRefundAccount } from "./refund-account"
import {
  moneyState,
  requestRefundedTotal,
  requestRefunds,
  type RefundCreditNote,
  type RefundEntry,
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

/**
 * Způsob vrácení slovy (§13.3) — do e-mailů i protokolu. Ruční vrácení =
 * převod; s účtem ze žádosti (`refund_account`) ho zákazník vidí, ať ví, kam
 * peníze přijdou.
 */
export const refundMethodLabel = (method: unknown, account?: unknown): string => {
  if (method === "comgate") {
    // Ne „na kartu": ComGate bere i převod, Apple Pay a Google Pay a vrací
    // stejnou cestou. Šablony poznají tenhle způsob podle slova „ComGate".
    return "stejnou cestou, jakou jste platili (přes ComGate) — na účtu do 3–5 pracovních dnů"
  }
  const stored = storedRefundAccount(account)
  return stored
    ? `převodem na váš účet ${stored.display}`
    : "převodem na váš účet (pokud číslo účtu ještě nemáme, ozveme se vám)"
}

/**
 * Dobropis k refundaci slovy (§13.3): číslo, nebo proč zatím není. „Skipped"
 * ve zkušebním režimu říká zákazníkovi i majitelce, že doklad přijde v
 * ostrém režimu; chyba iDokladu se zákazníkovi nepíše (vývojář má upozornění).
 */
export const creditNoteText = (creditNote: RefundCreditNote | null | undefined): string | null => {
  if (!creditNote) return null
  if ((creditNote.status === "issued" || creditNote.status === "exists") && creditNote.number) {
    return `č. ${creditNote.number}`
  }
  if (creditNote.status === "skipped" && creditNote.reason) {
    return creditNote.reason
  }
  return null
}

/** Refundace žádosti ve tvaru pro protokol — s košíkem a dobropisem (§13.2–13.3). */
export const protocolRefundsOf = (
  request: any,
  currency: string | null | undefined
): ProtocolRefund[] => {
  const code = String(currency || "czk")
  return requestRefunds(request).map((refund) => ({
    amount: refund.amount,
    currency: code,
    method: refund.method,
    at: refund.at ? new Date(refund.at) : new Date(),
    note: refund.note ?? null,
    lines: refund.lines?.length
      ? refund.lines.map((line) => refundLineText(line, code))
      : null,
    creditNote: creditNoteText(refund.credit_note),
  }))
}

/**
 * Data o dobropisu pro e-mail (`creditNoteNumber` / `creditNoteUrl`, nebo
 * `creditNoteNote` = věta, proč doklad zatím není). Bere se poslední refundace
 * žádosti, která nějaký výsledek nese.
 */
export const creditNoteEmailData = (
  refunds: RefundEntry[],
  override?: RefundCreditNote | null
): Record<string, unknown> => {
  const creditNote =
    override ??
    [...refunds].reverse().find((refund) => refund.credit_note)?.credit_note ??
    null
  if (!creditNote) return {}
  if ((creditNote.status === "issued" || creditNote.status === "exists") && creditNote.number) {
    return {
      creditNoteNumber: creditNote.number,
      ...(creditNote.pdf_url ? { creditNoteUrl: creditNote.pdf_url } : {}),
    }
  }
  if (creditNote.status === "skipped" && creditNote.reason) {
    return { creditNoteNote: `Opravný daňový doklad (dobropis): ${creditNote.reason}` }
  }
  return {}
}

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
    damageCause: damageCauseSentence(request.damage_cause),
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
 * `items` = položky slovy (přednostně `line_items`), `carrierDamage` /
 * `damagedItem` = věta „Poškozeno přepravou" / „Poškozený kus" v šablonách,
 * které ji umí (§11.3, §11.5, §13.7).
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
    ...(request.damage_cause === "damaged" ? { damagedItem: true } : {}),
    ...(link ? { orderLink: link } : {}),
    ...(claimsUrl ? { claimsUrl } : {}),
    ...(protocolUrl ? { protocolUrl } : {}),
  }
}

/**
 * „Potvrzení o vyřízení" — JEDINÝ e-mail za uzavření žádosti, ať skončila
 * refundací, opravou nebo výměnou. Volá ho `resolve`, `cancel-production` i
 * poslední `refund`. Když se vracely peníze, nese košík (řádky přes všechny
 * refundace), způsob (karta ComGate / ručně) a dobropis (§13.3) — ten se čte
 * ze záznamů refundací na žádosti, takže volající nic skládat nemusí.
 */
export const sendResolvedEmail = async (
  container: MedusaContainer,
  request: any,
  options: {
    protocolUrl?: string | null
    currency?: string | null
    note?: string | null
    creditNote?: RefundCreditNote | null
  }
): Promise<void> => {
  const total = requestRefundedTotal(request)
  const currency = options.currency ?? "czk"
  const refunds = requestRefunds(request)
  const refundLines = requestRefundLinesText(request, currency)
  await sendCustomerEmail(container, {
    template: "return-resolved",
    to: request.email,
    key: `return-resolved:${request.id}`,
    orderId: request.order_id,
    data: {
      subject:
        request.kind === "reklamace"
          ? "Reklamace je vyřízená — potvrzení"
          : request.kind === "uprava"
            ? "Rozdíl po úpravě objednávky jsem vám vrátila"
            : "Vrácení je vyřízené — potvrzení",
      ...claimEmailBase(request, options.protocolUrl),
      resolvedAt: formatDate(request.resolved_at ?? new Date()),
      ...(total > 0
        ? {
            refundAmount: formatMoney(total, currency),
            refundMethod: refundMethodLabel(request.refund_method, request.refund_account),
            ...(refundLines ? { refundLines } : {}),
            ...creditNoteEmailData(refunds, options.creditNote),
          }
        : {}),
      ...(options.note ? { note: options.note } : {}),
    },
  })
}

/** Zakázka pro řádek seznamu — totéž, co čte detail (`productionBlockOf`). */
const LIST_PRODUCTION_FIELDS = [
  "id",
  "order_id",
  "stage",
  "agreed_total",
  "original_total",
  "surcharge",
  // Smluvní záloha a fáze zrušení (LEGAL_AUDIT.md § 0) — čte je `productionBlockOf`.
  "deposit_percentage",
  "deposit_amount",
  "production_start_notified_at",
  "deposit_refunded",
  "deposit_refunded_at",
  "cancelled_at",
  "cancelled_by",
  "cancellation_phase",
  "cancellation_refund_amount",
  "payment_requests.type",
  "payment_requests.status",
  "payment_requests.amount",
  "payment_requests.created_at",
]

/**
 * Dopočet `captured_total` / `refunded_total` / `remaining` ke každému řádku
 * seznamu — z plateb objednávky a ze VŠECH žádostí k ní (sourozenci se počítají
 * do „vráceno" taky). Jeden dotaz na objednávky, jeden na sourozence, jeden na
 * zakázky (§12: `case` pro štítek případu v seznamu — žádné N+1).
 *
 * `suggested_amount` (§11.2) = výchozí částka pro „Vrátit peníze": s položkami
 * `min(remaining, Σ line_items.total)`, bez položek `remaining`.
 * `case` (§12.5) = tentýž `planClaimCase` jako detail, bez položek.
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
      case: null,
      is_commission: false,
      is_mixed: false,
    }))
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query
    .graph({
      entity: "order",
      fields: [...MONEY_STATE_FIELDS, "status", "canceled_at", ...CLAIM_FLAG_ORDER_FIELDS],
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

  // Zakázky ke všem objednávkám stránky jedním dotazem — link vede jen
  // z `production_order` k objednávce, z objednávky se zakázka nedočte.
  const { data: productions } = await query
    .graph({
      entity: "production_order",
      fields: LIST_PRODUCTION_FIELDS,
      filters: { order_id: orderIds },
    })
    .catch(() => ({ data: [] as any[] }))
  const productionByOrder = new Map(
    (productions as any[]).map((production) => [production.order_id, production])
  )

  return requests.map((request) => {
    const order = byOrder.get(request.order_id)
    const state = order
      ? moneyState(order, siblingsByOrder.get(request.order_id) ?? [request])
      : { captured: 0, refunded: 0, remaining: 0 }
    const productionRow = productionByOrder.get(request.order_id) ?? null
    const production = productionRow
      ? productionBlockOf(productionRow, productionRow.payment_requests ?? [])
      : null
    const flags = order ? claimFlagsOf(order, state, Boolean(production)) : null
    const plan =
      order && flags
        ? planClaimCase({
            request,
            flags,
            money: state,
            production,
            order: { status: order.status, canceled_at: order.canceled_at },
          })
        : null
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
      case: plan?.case ?? null,
      is_commission: flags?.is_commission ?? false,
      is_mixed: flags?.is_mixed ?? false,
    }
  })
}
