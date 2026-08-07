import {
  AbstractPaymentProvider,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"

/**
 * „Dobírka" — the carrier collects the money on delivery.
 *
 * ## A reversal, recorded on purpose
 *
 * `docs/feature-ideas.md` carried a standing rule — *never dobírka* — and the
 * Osobní odběr provider exists partly because of it. That rule was **lifted on
 * 2026-08-07, agreed with the owner in the meeting that day**: she wants it,
 * and she wants to decide per product, by hand. The doc records the reversal;
 * this note exists so nobody reading only the module wonders.
 *
 * The reasoning behind the old rule has not gone away — a refused parcel costs
 * the carriage both ways — which is why it is opt-in per piece rather than a
 * shop-wide switch. „Never pay-later" still stands and is untouched: money
 * collected on delivery by a carrier is not money deferred to an invoice.
 *
 * ## Why it authorizes and never captures
 *
 * Identical reasoning to Osobní odběr: an order cannot be placed in Medusa
 * without a payment session, but no money has moved when the parcel leaves.
 * Reporting `authorized` keeps every downstream rule honest without any of
 * them needing to know this provider exists —
 *
 * - `authorized` is not a payment problem, so the order lands in „Nové";
 * - the A2 ship gate compares **captured** against the total, so it blocks
 *   dispatch until she records the money — which is right, the carrier has
 *   not handed it over yet;
 * - Statistiky and the daily digest count captured money, so an order in
 *   transit never inflates the takings.
 *
 * Capture is her writing down that the carrier settled.
 */
class DobirkaPaymentService extends AbstractPaymentProvider {
  /**
   * ASCII, like its sibling: this ends up in a provider id, a URL and a
   * database column. The admin renders `pp_<identifier>_<id>` as
   * `Name (TYPE)`, so this reads „Dobirka (DOBIRKA)".
   */
  static identifier = "dobirka"

  protected readonly logger_: Logger

  constructor(
    container: { logger: Logger },
    options: Record<string, unknown> = {}
  ) {
    super(container, options)
    this.logger_ = container.logger
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    return {
      id: `dobirka_${input.context?.idempotency_key ?? Date.now()}`,
      data: {
        dobirka: true,
        amount: input.amount,
        currency_code: input.currency_code,
        // Explicit so nothing has to infer that the money is still with the carrier.
        collected: false,
      },
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    return {
      status: PaymentSessionStatus.AUTHORIZED,
      data: { ...(input.data ?? {}), collected: false },
    }
  }

  /** Records that the carrier settled. Nothing is charged here. */
  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    return {
      data: {
        ...(input.data ?? {}),
        collected: true,
        collected_at: new Date().toISOString(),
      },
    }
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    return {
      data: {
        ...(input.data ?? {}),
        refunded: true,
        refunded_at: new Date().toISOString(),
      },
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: { ...(input.data ?? {}), canceled: true } }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const collected = Boolean((input.data as any)?.collected)
    return {
      status: collected
        ? PaymentSessionStatus.CAPTURED
        : PaymentSessionStatus.AUTHORIZED,
      data: input.data ?? {},
    }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    return { action: "not_supported" }
  }
}

export default DobirkaPaymentService
