import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { formatMoney, orderLink } from "../../../../../lib/customer-email"
import { issueCreditNoteForOrder } from "../../../../../lib/idoklad-invoice"
import { RETURN_REQUEST_MODULE } from "../../../../../modules/return-request"
import type ReturnRequestModuleService from "../../../../../modules/return-request/service"

/**
 * POST /admin/return-requests/:id/refund — vrácení peněz k jedné žádosti.
 *
 * Reuse téhož enginu jako „Vrátit rozdíl" (merchant-orders/refund-difference):
 * placeno kartou → ComGate přes `refundPaymentWorkflow` (idempotentní, hlídá
 * přeplatek), jinak „manual" (hotovost/dobírka/osobní odběr — majitelka vrací
 * ručně). Částku zadá admin; výchozí je celá zachycená částka a sevře se do
 * toho, co reálně došlo. Zapíše se na žádost (`refund_*`) i do peněžní stopy
 * objednávky a zákazník dostane e-mail „vrácení peněz". Dvojí vrácení nejde.
 *
 * Pozn.: dobropis v iDokladu je fáze 2 — tady se peníze jen vrací a eviduje.
 */

type RefundBody = { amount?: number; note?: string | null }

const KIND_LABEL: Record<string, string> = {
  reklamace: "Reklamace",
  vraceni: "Vrácení zboží",
  odstoupeni: "Odstoupení od smlouvy",
}

export const POST = async (
  req: MedusaRequest<RefundBody>,
  res: MedusaResponse
) => {
  const body = (req.body || {}) as RefundBody
  const service = req.scope.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )

  let request: any
  try {
    request = await service.retrieveReturnRequest(req.params.id)
  } catch {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Žádost o vrácení nebyla nalezena."
    )
  }

  if (request.refunded_at) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Peníze u téhle žádosti už byly vráceny."
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "total",
      "metadata",
      "customer.first_name",
      "payment_collections.payments.id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.amount",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.canceled_at",
    ],
    filters: { id: request.order_id },
  })
  const order = orders[0] as any
  if (!order) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka k této žádosti nebyla nalezena."
    )
  }

  const captured = (order.payment_collections ?? [])
    .flatMap((collection: any) => collection?.payments ?? [])
    .filter((payment: any) => payment?.captured_at && !payment?.canceled_at)
  const capturedTotal = captured.reduce(
    (sum: number, payment: any) => sum + Number(payment?.amount || 0),
    0
  )

  // Částka: zadaná adminem, jinak celá zachycená. Sevřená do zachycené částky,
  // ať nejde vrátit víc, než reálně došlo (ComGate by to stejně odmítl).
  const requested =
    typeof body.amount === "number" && body.amount > 0
      ? body.amount
      : capturedTotal
  const amount = capturedTotal > 0 ? Math.min(requested, capturedTotal) : requested

  if (!(amount > 0)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "U této objednávky není co vrátit — žádná zachycená platba."
    )
  }

  const cardPayment = captured.find(
    (payment: any) => payment?.provider_id === "pp_comgate_comgate"
  )

  let method: "comgate" | "manual" = "manual"
  if (cardPayment) {
    await refundPaymentWorkflow(req.scope).run({
      input: {
        payment_id: cardPayment.id,
        amount,
        note:
          (typeof body.note === "string" && body.note.trim()) ||
          `Vrácení k žádosti (${KIND_LABEL[request.kind] ?? "vrácení"}) — objednávka #${order.display_id}`,
      } as never,
    })
    method = "comgate"
  }

  const now = new Date()
  const updated = await service.updateReturnRequests({
    id: request.id,
    refund_amount: amount,
    refund_method: method,
    refunded_at: now,
  })

  // Peněžní stopa na objednávce — stejný tvar jako „Vrátit rozdíl", ať je
  // vrácení dohledatelné na jednom místě.
  const metadata = (order.metadata ?? {}) as Record<string, any>
  const history = Array.isArray(metadata.refund_history)
    ? metadata.refund_history
    : []
  const orderModule = req.scope.resolve(Modules.ORDER) as any
  await orderModule.updateOrders([
    {
      id: order.id,
      metadata: {
        ...metadata,
        refund_history: [
          ...history,
          {
            amount,
            currency_code: order.currency_code,
            reason: `return:${request.kind ?? "vraceni"}`,
            method,
            refunded_at: now.toISOString(),
            return_request_id: request.id,
          },
        ],
      },
    },
  ])

  if (order.email) {
    const notifications = req.scope.resolve(Modules.NOTIFICATION)
    await notifications
      .createNotifications({
        to: order.email,
        channel: "email",
        template: "order-refunded",
        data: {
          customerName: order.customer?.first_name ?? undefined,
          orderNumber: `#${order.display_id}`,
          refundAmount: formatMoney(amount, order.currency_code),
          refundReason: KIND_LABEL[request.kind] ?? "Vrácení peněz",
          orderLink: orderLink(order) || undefined,
        },
        idempotency_key: `return-refund:${request.id}`,
      } as never)
      .catch(() => {
        // Peníze se vrátily — nepovedený e-mail je vidět v Přehled → E-maily.
      })
  }

  // Dobropis (opravný daňový doklad) k vrácení — best-effort. Jen plné vrácení
  // s existující fakturou a mimo zkušební režim; chyba nic neshodí, peníze jsou
  // vrácené tak jako tak. Částečné vrácení majitelce připomene ruční dobropis.
  const creditNote = await issueCreditNoteForOrder(req.scope, order, {
    amount,
  }).catch(() => ({ status: "error" as const, reason: "neznámá chyba" }))

  const baseMessage =
    method === "comgate"
      ? `Vráceno ${formatMoney(amount, order.currency_code)} na kartu přes ComGate.`
      : `Zaznamenáno ${formatMoney(amount, order.currency_code)} k ručnímu vrácení (objednávka nebyla placená kartou).`
  const creditMessage =
    creditNote.status === "issued"
      ? ` Dobropis ${creditNote.number ?? ""} vystaven.`
      : creditNote.status === "exists"
        ? " Dobropis už byl vystaven."
        : ""

  res.status(200).json({
    refunded: true,
    method,
    amount,
    credit_note: creditNote,
    return_request: updated,
    message: `${baseMessage}${creditMessage}`,
  })
}
