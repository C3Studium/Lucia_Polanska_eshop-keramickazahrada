import { AbstractPaymentProvider } from "@medusajs/framework/utils"
import type { Logger } from "@medusajs/framework/types"
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
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/types"
import {
  type ComgatePaymentDetails,
  type ComgatePaymentStatus,
  fromComgateMinorUnits,
  parseComgateStatus,
  requestComgateJson,
  resolveComgateCountry,
  resolveComgateExpirationTime,
  resolveComgateMethod,
  resolveComgateTestMode,
  resolveComgateTransactionId,
  resolveStorefrontReturnUrl,
  secureCompare,
  toComgateMinorUnits,
} from "./utils"

type ComgateOptions = {
  merchant: string
  secret: string
  test?: boolean | string
  country?: string
  curr?: string
  method?: string
  request_timeout_ms?: number
}

type InjectedDependencies = {
  logger: Logger
}

type ComgateCreateResponse = {
  code: number | string
  message: string
  transId: string
  redirect: string
  [key: string]: unknown
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}

const optionalString = (value: unknown): string | undefined => {
  const normalized = typeof value === "string" ? value.trim() : ""
  return normalized || undefined
}

const cleanRecord = (
  value: Record<string, unknown>
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) => entry !== undefined && entry !== null && entry !== ""
    )
  )

class ComgatePaymentProviderService extends AbstractPaymentProvider<ComgateOptions> {
  static identifier = "comgate"

  protected logger_: Logger
  protected options: ComgateOptions

  static validateOptions(options: Record<string, unknown>) {
    if (!options?.merchant || !options?.secret) {
      throw new Error(
        "Comgate payment provider requires `merchant` and `secret` options"
      )
    }
  }

  constructor(container: InjectedDependencies, options: ComgateOptions) {
    super(container, options)
    this.logger_ = container.logger
    this.options = options
  }

  private credentials() {
    const merchant = this.options?.merchant
    const secret = this.options?.secret

    if (!merchant || !secret) {
      throw new Error("Comgate credentials are not configured")
    }

    return { merchant, secret }
  }

  private async request<T extends Record<string, unknown>>(
    path: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE"
      body?: Record<string, unknown>
    } = {}
  ): Promise<T> {
    return requestComgateJson<T>(path, {
      ...this.credentials(),
      ...options,
      timeoutMs: this.options.request_timeout_ms,
    })
  }

  private async retrieveDetails(transId: string): Promise<ComgatePaymentDetails> {
    const payload = await this.request<ComgatePaymentDetails>(
      `/payment/transId/${encodeURIComponent(transId)}.json`
    )
    const status = parseComgateStatus(payload.status)
    const returnedId = resolveComgateTransactionId(payload)
    const price = Number(payload.price)

    if (
      returnedId !== transId ||
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      typeof payload.refId !== "string" ||
      !payload.refId ||
      typeof payload.curr !== "string" ||
      !payload.curr
    ) {
      throw new Error("Comgate returned incomplete or mismatched payment data")
    }

    return {
      ...payload,
      status,
      transId: returnedId,
      price,
      curr: payload.curr.toUpperCase(),
    }
  }

  private medusaStatus(status: ComgatePaymentStatus): GetPaymentStatusOutput["status"] {
    switch (status) {
      case "PAID":
        return "captured"
      case "CANCELLED":
        return "canceled"
      case "AUTHORIZED":
        // AUTHORIZED is a reversible Comgate pre-authorization. Only PAID is paid.
        return "pending_authorization"
      case "PENDING":
      default:
        return "pending"
    }
  }

  private providerData(
    existing: Record<string, unknown>,
    details: ComgatePaymentDetails,
    extra: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return cleanRecord({
      ...existing,
      id: details.transId,
      transId: details.transId,
      session_id: details.refId,
      refId: details.refId,
      method: details.method,
      providerStatus: details.status,
      provider_status: details.status,
      amount: fromComgateMinorUnits(details.price),
      price: Number(details.price),
      currency: details.curr.toLowerCase(),
      curr: details.curr,
      test: resolveComgateTestMode(details.test),
      paymentErrorReason: details.paymentErrorReason,
      lastCheckedAt: new Date().toISOString(),
      ...extra,
    })
  }

  private statusResult(
    existing: Record<string, unknown>,
    details: ComgatePaymentDetails
  ): GetPaymentStatusOutput {
    return {
      status: this.medusaStatus(details.status),
      data: this.providerData(existing, details),
    }
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const data = asRecord(input.data)
    const existingTransId = resolveComgateTransactionId(data)

    // Medusa can retry provider operations. Reuse a transaction already persisted
    // in the payment session instead of creating a second Comgate payment.
    if (existingTransId) {
      const details = await this.retrieveDetails(existingTransId)
      return {
        id: existingTransId,
        ...this.statusResult(data, details),
      }
    }

    const currency = String(input.currency_code || this.options.curr || "CZK")
      .trim()
      .toUpperCase()
    const price = toComgateMinorUnits(input.amount, currency)
    const sessionId = optionalString(data.session_id) || input.context?.idempotency_key
    if (!sessionId) {
      throw new Error("Medusa payment session ID is required for Comgate")
    }

    const cartId = optionalString(data.cart_id)
    const country = resolveComgateCountry(
      data.country_code,
      resolveComgateCountry(this.options.country, "CZ")
    )
    const method = resolveComgateMethod(
      data.method,
      resolveComgateMethod(this.options.method, "ALL")
    )
    const email =
      optionalString(input.context?.customer?.email) || optionalString(data.email)
    const phone =
      optionalString(input.context?.customer?.phone) || optionalString(data.phone)

    if (!email && !phone) {
      throw new Error("Comgate requires a customer email address or phone number")
    }

    const firstName =
      optionalString(input.context?.customer?.first_name) ||
      optionalString(data.first_name) ||
      ""
    const lastName =
      optionalString(input.context?.customer?.last_name) ||
      optionalString(data.last_name) ||
      ""
    const fullName =
      optionalString(data.full_name) ||
      `${firstName} ${lastName}`.trim() ||
      "Zákazník"
    const delivery = ["HOME_DELIVERY", "PICKUP", "ELECTRONIC_DELIVERY"].includes(
      String(data.delivery)
    )
      ? String(data.delivery)
      : "HOME_DELIVERY"
    const category =
      data.category === "OTHER" ? "OTHER" : "PHYSICAL_GOODS_ONLY"
    const fallbackBase = cartId
      ? `/${country.toLowerCase()}/cart/${cartId}`
      : `/${country.toLowerCase()}/payment/${sessionId}`
    const paidUrl = resolveStorefrontReturnUrl(
      process.env.STOREFRONT_PUBLIC_URL,
      data.url_paid,
      `${fallbackBase}/confirmed`
    )
    const cancelledUrl = resolveStorefrontReturnUrl(
      process.env.STOREFRONT_PUBLIC_URL,
      data.url_cancelled,
      `${fallbackBase}/canceled`
    )
    const pendingUrl = resolveStorefrontReturnUrl(
      process.env.STOREFRONT_PUBLIC_URL,
      data.url_pending,
      `${fallbackBase}/pending`
    )
    const expirationTime = resolveComgateExpirationTime(data.expirationTime)

    const payload = cleanRecord({
      test: resolveComgateTestMode(this.options.test),
      country,
      price,
      curr: currency,
      label: (optionalString(data.label) || "Keram. zahrada").slice(0, 16),
      // Comgate sends refId back in its push callback. It must be the Medusa
      // payment-session ID so the verified callback can target exactly one session.
      refId: sessionId,
      payerId: cartId,
      method,
      email,
      phone,
      fullName,
      billingAddrCity: optionalString(data.billing_city),
      billingAddrStreet: optionalString(data.billing_street),
      billingAddrPostalCode: optionalString(data.billing_postal_code),
      billingAddrCountry: country,
      delivery,
      homeDeliveryCity:
        delivery === "HOME_DELIVERY"
          ? optionalString(data.shipping_city)
          : undefined,
      homeDeliveryStreet:
        delivery === "HOME_DELIVERY"
          ? optionalString(data.shipping_street)
          : undefined,
      homeDeliveryPostalCode:
        delivery === "HOME_DELIVERY"
          ? optionalString(data.shipping_postal_code)
          : undefined,
      homeDeliveryCountry: delivery === "HOME_DELIVERY" ? country : undefined,
      category,
      name: optionalString(data.name),
      lang: optionalString(data.lang) || "cs",
      preauth: data.preauth === true ? true : undefined,
      expirationTime,
      enableApplePayGooglePay: data.enableApplePayGooglePay !== false,
      url_paid: paidUrl,
      url_cancelled: cancelledUrl,
      url_pending: pendingUrl,
    })

    // Comgate has no idempotency-key header. Do not automatically retry this
    // request on network errors: its outcome may be indeterminate.
    const response = await this.request<ComgateCreateResponse>("/payment.json", {
      method: "POST",
      body: payload,
    })

    if (
      !resolveComgateTransactionId(response) ||
      typeof response.redirect !== "string" ||
      !response.redirect.startsWith("https://")
    ) {
      throw new Error("Comgate returned an invalid payment creation response")
    }

    return {
      id: response.transId,
      status: "pending",
      data: {
        id: response.transId,
        transId: response.transId,
        redirectUrl: response.redirect,
        method,
        session_id: sessionId,
        refId: sessionId,
        providerStatus: "PENDING",
        provider_status: "PENDING",
        amount: fromComgateMinorUnits(price),
        price,
        currency: currency.toLowerCase(),
        curr: currency,
        test: resolveComgateTestMode(this.options.test),
        idempotency_key: input.context?.idempotency_key,
        createdAt: new Date().toISOString(),
      },
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    return this.getPaymentStatus(input)
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const data = asRecord(input.data)
    const transId = resolveComgateTransactionId(data)
    if (!transId) {
      throw new Error("Comgate transaction ID is required")
    }

    const details = await this.retrieveDetails(transId)
    return this.statusResult(data, details)
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    const data = asRecord(input.data)
    const transId = resolveComgateTransactionId(data)
    if (!transId) {
      throw new Error("Comgate transaction ID is required for capture")
    }

    let details = await this.retrieveDetails(transId)
    if (details.status === "PAID") {
      return { data: this.providerData(data, details) }
    }
    if (details.status !== "AUTHORIZED") {
      throw new Error(
        `Comgate payment ${transId} cannot be captured from ${details.status}`
      )
    }

    await this.request(`/preauth/transId/${encodeURIComponent(transId)}.json`, {
      method: "PUT",
      // Medusa's provider contract captures the whole payment; it doesn't pass
      // a partial-capture amount to CapturePaymentInput.
      body: { amount: Number(details.price) },
    })
    details = await this.retrieveDetails(transId)
    if (details.status !== "PAID") {
      throw new Error(
        `Comgate pre-authorization ${transId} has not reached PAID status`
      )
    }

    return { data: this.providerData(data, details) }
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    const data = asRecord(input.data)
    const transId = resolveComgateTransactionId(data)
    if (!transId) {
      throw new Error("Comgate transaction ID is required for refund")
    }

    const details = await this.retrieveDetails(transId)
    if (details.status !== "PAID") {
      throw new Error(
        `Only PAID Comgate payments can be refunded; ${transId} is ${details.status}`
      )
    }

    const refundIdempotencyKey = optionalString(input.context?.idempotency_key)
    if (
      refundIdempotencyKey &&
      data.lastRefundIdempotencyKey === refundIdempotencyKey
    ) {
      return { data }
    }

    const amount = toComgateMinorUnits(input.amount, details.curr)
    const previouslyRefunded = Number(data.refundedAmountMinor || 0)
    if (
      !Number.isSafeInteger(previouslyRefunded) ||
      previouslyRefunded < 0 ||
      previouslyRefunded + amount > Number(details.price)
    ) {
      throw new Error("Comgate refund cannot exceed the original payment amount")
    }

    await this.request("/refund.json", {
      method: "POST",
      body: cleanRecord({
        transId,
        amount,
        test: resolveComgateTestMode(details.test),
        refId: refundIdempotencyKey,
      }),
    })

    return {
      data: this.providerData(data, details, {
        lastRefundAmount: fromComgateMinorUnits(amount),
        lastRefundAmountMinor: amount,
        lastRefundIdempotencyKey: refundIdempotencyKey,
        lastRefundRequestedAt: new Date().toISOString(),
        refundedAmountMinor: previouslyRefunded + amount,
      }),
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = asRecord(input.data)
    const transId = resolveComgateTransactionId(data)
    if (!transId) {
      return { data }
    }

    const details = await this.retrieveDetails(transId)
    if (details.status === "CANCELLED") {
      return { data: this.providerData(data, details) }
    }
    if (details.status === "PAID") {
      throw new Error(
        `Paid Comgate payment ${transId} cannot be cancelled; use a refund`
      )
    }

    const path =
      details.status === "AUTHORIZED"
        ? `/preauth/transId/${encodeURIComponent(transId)}.json`
        : `/payment/transId/${encodeURIComponent(transId)}.json`
    await this.request(path, { method: "DELETE" })

    return {
      data: this.providerData(data, {
        ...details,
        status: "CANCELLED",
      }),
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const data = asRecord(input.data)
    const transId = resolveComgateTransactionId(data)
    if (!transId) {
      throw new Error("Comgate transaction ID is required")
    }

    const details = await this.retrieveDetails(transId)
    return { data: this.providerData(data, details) }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const data = asRecord(input.data)
    const transId = resolveComgateTransactionId(data)
    if (!transId) {
      return this.initiatePayment(input)
    }

    const details = await this.retrieveDetails(transId)
    const nextCurrency = String(input.currency_code).toUpperCase()
    const nextAmount = toComgateMinorUnits(input.amount, nextCurrency)
    const nextMethod = resolveComgateMethod(data.method, details.method || "ALL")
    const unchanged =
      Number(details.price) === nextAmount &&
      details.curr === nextCurrency &&
      (details.method || "ALL") === nextMethod

    if (unchanged || details.status === "PAID" || details.status === "AUTHORIZED") {
      if (!unchanged && details.status !== "PENDING") {
        throw new Error(
          `Comgate payment ${transId} cannot be changed from ${details.status}`
        )
      }
      return this.statusResult(data, details)
    }

    if (details.status === "PENDING") {
      await this.cancelPayment({ data })
    }

    const replacementData = { ...data }
    for (const key of [
      "id",
      "transId",
      "providerStatus",
      "provider_status",
      "redirectUrl",
      "createdAt",
      "lastCheckedAt",
    ]) {
      delete replacementData[key]
    }

    return this.initiatePayment({ ...input, data: replacementData })
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const callback = asRecord(payload.data)
    const { merchant, secret } = this.credentials()

    if (
      !secureCompare(callback.secret, secret) ||
      !secureCompare(callback.merchant, merchant)
    ) {
      this.logger_.warn("Rejected an unauthenticated Comgate push notification")
      return { action: "not_supported" }
    }

    const transId = resolveComgateTransactionId({ transId: callback.transId })
    if (!transId) {
      this.logger_.warn("Rejected a Comgate push notification without transId")
      return { action: "not_supported" }
    }

    const details = await this.retrieveDetails(transId)
    const callbackStatus = (() => {
      try {
        return parseComgateStatus(callback.status)
      } catch {
        return null
      }
    })()
    const callbackTest = resolveComgateTestMode(callback.test)
    const verifiedTest = resolveComgateTestMode(details.test)
    const matchesVerifiedPayment =
      callbackStatus !== null &&
      Number(callback.price) === Number(details.price) &&
      String(callback.curr || "").toUpperCase() === details.curr &&
      String(callback.refId || "") === details.refId &&
      callbackTest === verifiedTest

    if (!matchesVerifiedPayment) {
      this.logger_.warn(
        `Rejected mismatched Comgate push notification for ${transId}`
      )
      return { action: "not_supported" }
    }

    if (callbackStatus !== details.status) {
      this.logger_.info(
        `Comgate push status ${callbackStatus} was superseded by verified status ${details.status} for ${transId}`
      )
    }

    // New payments deliberately use the Medusa payment-session ID as refId.
    // Refuse unrelated/legacy references rather than targeting an arbitrary cart.
    if (!details.refId.startsWith("payses_")) {
      this.logger_.warn(
        `Ignored Comgate transaction ${transId} without a Medusa payment-session reference`
      )
      return { action: "not_supported" }
    }

    const action: WebhookActionResult["action"] =
      details.status === "PAID"
        ? "captured"
        : details.status === "CANCELLED"
        ? "canceled"
        : details.status === "AUTHORIZED"
        ? "pending_authorization"
        : "pending"

    return {
      action,
      data: {
        session_id: details.refId,
        amount: fromComgateMinorUnits(details.price),
      },
    }
  }

  // Backward-compatible helpers retained for code that used the old provider
  // directly. They now delegate to the real Comgate operations.
  async getPaymentDetails(paymentId: string): Promise<Record<string, unknown>> {
    return (await this.retrievePayment({ data: { transId: paymentId } })).data || {}
  }

  async createPayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    return this.initiatePayment(input)
  }
}

export default ComgatePaymentProviderService
