import { AbstractPaymentProvider, PaymentSessionStatus } from "@medusajs/framework/utils"
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
 * „Zaplatím při vyzvednutí" — payment taken in person, at her workshop.
 *
 * ## What it is, and what it is not
 *
 * It is **not** dobírka. Dobírka is money collected by a *carrier* on delivery,
 * and D1 rules that out. This is the customer driving to her address, taking
 * the piece and paying her directly — the only case where goods and money meet
 * outside the online flow. It is only ever offered together with the „Osobní
 * odběr" shipping option.
 *
 * ## Why it authorizes and never captures
 *
 * A payment provider has to exist for checkout to complete at all; Medusa
 * cannot place an order with no payment session. So this one accepts the
 * session and reports **`authorized`** — a promise to pay — and stops there.
 *
 * Everything downstream then behaves correctly *without knowing this provider
 * exists*:
 *
 * - `authorized` is not a payment problem (`payment-state.ts`), so the order
 *   lands in „Nové" like any other rather than in the problem queue;
 * - the A2 ship gate compares **captured** minus refunded against the total, so
 *   it **blocks** dispatch — which is right, nobody has paid yet;
 * - Statistiky and the daily digest count captured money, so an order that was
 *   promised but never collected never inflates the takings.
 *
 * Money only becomes real when she captures it, which is what the „Vyzvednuto a
 * zaplaceno" action in the admin does at the moment the customer hands it over.
 * Capturing is the *record* of cash changing hands, not a charge — there is no
 * card to charge.
 */
class PickupPaymentService extends AbstractPaymentProvider {
  static identifier = "pickup"

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
      id: `pickup_${input.context?.idempotency_key ?? Date.now()}`,
      data: {
        pickup: true,
        amount: input.amount,
        currency_code: input.currency_code,
        // Deliberately explicit: anything reading this session should be able to
        // tell that no money has moved without inferring it.
        collected: false,
      },
    }
  }

  /**
   * Accepts the order without taking money.
   *
   * `authorized` rather than `captured` is the entire point — see the class
   * comment. Returning `captured` here would make every uncollected order look
   * paid and let it ship.
   */
  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    return {
      status: PaymentSessionStatus.AUTHORIZED,
      data: { ...(input.data ?? {}), collected: false },
    }
  }

  /**
   * Records that she was paid in person. There is nothing to charge — this
   * writes down what already happened at the counter.
   */
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

  /**
   * Refunding cash means handing cash back. Recorded, not moved — there is no
   * card to send money to, which is why this cannot fail.
   */
  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    return {
      data: {
        ...(input.data ?? {}),
        refunded_amount: input.amount,
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

  /** Nothing external ever calls back about cash. */
  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    return { action: "not_supported" }
  }
}

export default PickupPaymentService
