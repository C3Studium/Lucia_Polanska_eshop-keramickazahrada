import type { Logger } from "@medusajs/framework/types"
import {
  REPORT_LANGUAGE_CZ,
  type IdokladContact,
  type IdokladContactPayload,
  type IdokladCountry,
  type IdokladCurrency,
  type IdokladInvoiceDefault,
  type IdokladInvoicePayload,
  type IdokladIssuedInvoice,
  type IdokladOptions,
  type IdokladPagedList,
  type IdokladPaymentOption,
} from "./types"
import {
  requestIdokladJson,
  requestIdokladToken,
  resolveBooleanOption,
  resolveNumericOption,
} from "./utils"

type InjectedDependencies = {
  logger: Logger
}

/**
 * The iDoklad API v3 client (FINISHINGTODOLIST §1).
 *
 * A plain service module like `sanity` — it owns no data. Everything the shop
 * remembers about an invoice lives in `order.metadata.idoklad_*`; this class
 * only speaks HTTP: OAuth2 client-credentials with the token cached until
 * shortly before expiry, and the handful of v3 endpoints the shop needs
 * (contacts, invoice defaults, invoice creation, full payment, PDF).
 *
 * Orchestration — which order gets an invoice and when — lives in
 * `src/lib/idoklad-invoice.ts`, not here.
 */
export default class IdokladModuleService {
  protected logger_: Logger
  protected options_: IdokladOptions

  private tokenCache_: { token: string; expiresAtMs: number } | null = null
  private tokenRequest_: Promise<string> | null = null

  static validateOptions(options: Record<string, unknown>) {
    if (!options?.client_id || !options?.client_secret) {
      throw new Error(
        "iDoklad module requires `client_id` and `client_secret` options"
      )
    }
  }

  constructor(container: InjectedDependencies, options: IdokladOptions) {
    this.logger_ = container.logger
    this.options_ = options
  }

  get vatPayer(): boolean {
    return resolveBooleanOption(this.options_.vat_payer)
  }

  get testMode(): boolean {
    return resolveBooleanOption(this.options_.test_mode)
  }

  get numericSequenceId(): number | undefined {
    return resolveNumericOption(this.options_.numeric_sequence_id)
  }

  /**
   * A valid access token, from cache when possible. Concurrent callers share
   * one in-flight token request; the cache expires a minute early so a token
   * is never used at the edge of its lifetime.
   */
  private async getAccessToken(): Promise<string> {
    const cached = this.tokenCache_
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached.token
    }

    if (!this.tokenRequest_) {
      this.tokenRequest_ = (async () => {
        try {
          const response = await requestIdokladToken({
            clientId: this.options_.client_id,
            clientSecret: this.options_.client_secret,
            applicationId: this.options_.application_id,
            timeoutMs: this.options_.request_timeout_ms,
          })
          this.tokenCache_ = {
            token: response.access_token,
            expiresAtMs:
              Date.now() + Math.max(60, response.expires_in - 60) * 1000,
          }
          return response.access_token
        } finally {
          this.tokenRequest_ = null
        }
      })()
    }

    return this.tokenRequest_
  }

  private async request<T>(
    path: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
      body?: Record<string, unknown>
      query?: Record<string, string | number | boolean | undefined>
    } = {}
  ): Promise<T> {
    const token = await this.getAccessToken()
    return requestIdokladJson<T>(path, {
      ...options,
      token,
      timeoutMs: this.options_.request_timeout_ms,
    })
  }

  /** An empty invoice pre-filled from the agenda settings. */
  async getInvoiceDefault(): Promise<IdokladInvoiceDefault> {
    return this.request<IdokladInvoiceDefault>("/IssuedInvoices/Default")
  }

  async findContactByEmail(email: string): Promise<IdokladContact | null> {
    const trimmed = email.trim()
    if (!trimmed) {
      return null
    }
    const page = await this.request<IdokladPagedList<IdokladContact>>(
      "/Contacts",
      {
        query: {
          filter: `Email~eq~${trimmed}`,
          pagesize: 1,
        },
      }
    )
    return page.Items?.[0] ?? null
  }

  async createContact(payload: IdokladContactPayload): Promise<IdokladContact> {
    return this.request<IdokladContact>("/Contacts", {
      method: "POST",
      body: payload as unknown as Record<string, unknown>,
    })
  }

  async findCountryIdByCode(code: string): Promise<number | undefined> {
    const normalized = code.trim().toUpperCase()
    if (!normalized) {
      return undefined
    }
    const page = await this.request<IdokladPagedList<IdokladCountry>>(
      "/Countries",
      { query: { filter: `Code~eq~${normalized}`, pagesize: 1 } }
    )
    return page.Items?.[0]?.Id
  }

  async findCurrencyIdByCode(code: string): Promise<number | undefined> {
    const normalized = code.trim().toUpperCase()
    if (!normalized) {
      return undefined
    }
    const page = await this.request<IdokladPagedList<IdokladCurrency>>(
      "/Currencies",
      { query: { filter: `Code~eq~${normalized}`, pagesize: 1 } }
    )
    return page.Items?.[0]?.Id
  }

  async listPaymentOptions(): Promise<IdokladPaymentOption[]> {
    const page = await this.request<IdokladPagedList<IdokladPaymentOption>>(
      "/PaymentOptions",
      { query: { pagesize: 100 } }
    )
    return page.Items ?? []
  }

  async createInvoice(
    payload: IdokladInvoicePayload
  ): Promise<IdokladIssuedInvoice> {
    return this.request<IdokladIssuedInvoice>("/IssuedInvoices", {
      method: "POST",
      body: payload as unknown as Record<string, unknown>,
    })
  }

  async getInvoice(invoiceId: number): Promise<IdokladIssuedInvoice> {
    return this.request<IdokladIssuedInvoice>(`/IssuedInvoices/${invoiceId}`)
  }

  /** Records the invoice as fully paid on the given date. */
  async fullyPayInvoice(invoiceId: number, dateOfPayment: string): Promise<void> {
    await this.request<boolean>(
      `/IssuedDocumentPayments/FullyPay/${invoiceId}`,
      { method: "PUT", query: { dateOfPayment } }
    )
  }

  /** The invoice print PDF as bytes (the API answers base64 in the envelope). */
  async getInvoicePdf(invoiceId: number): Promise<Buffer> {
    const base64 = await this.request<string>(
      `/Reports/IssuedInvoice/${invoiceId}/Pdf`,
      { query: { compressed: false, language: REPORT_LANGUAGE_CZ } }
    )
    return Buffer.from(base64, "base64")
  }
}
