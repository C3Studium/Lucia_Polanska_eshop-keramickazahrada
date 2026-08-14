/**
 * iDoklad API v3 — the slice of the wire format this shop actually uses.
 *
 * Field names are PascalCase because that is what the API speaks; do not
 * "fix" them. Every response is wrapped in {@link IdokladEnvelope}, except the
 * OAuth token endpoint which follows the OAuth2 standard shape.
 */

export type IdokladOptions = {
  /** Client ID — Lucia generates it in iDoklad: Nastavení → Aplikace → API. */
  client_id: string
  /** Client Secret — same place as the client id. */
  client_secret: string
  /**
   * Application ID from the iDoklad Developer portal
   * (https://developer.idoklad.cz). The current v3 client-credentials flow
   * requires it; when present the v2 token endpoint is used. Left optional so
   * the module still works against the legacy token endpoint if iDoklad keeps
   * accepting it for older integrations.
   */
  application_id?: string
  /**
   * Whether Lucia is a VAT payer. Default false (neplátce DPH): items go out
   * with a zero VAT rate and iDoklad renders a non-tax document.
   */
  vat_payer?: boolean | string
  /**
   * Informational only — iDoklad has no sandbox, so "test mode" means the
   * credentials point at a separate trial/free agenda. The flag exists so the
   * admin widget can say so out loud; it changes no behaviour.
   */
  test_mode?: boolean | string
  /**
   * Optional override of the numeric sequence (číselná řada) used for issued
   * invoices. When absent, the agenda's default from `IssuedInvoices/Default`
   * is used — which is the plan until the production sequence is picked
   * (FINISHINGTODOLIST §1: „ostrá číselná řada až při přepnutí na produkci").
   */
  numeric_sequence_id?: number | string
  request_timeout_ms?: number
}

export type IdokladTokenResponse = {
  access_token: string
  token_type: string
  /** Seconds. The docs show 6000; treat it as data, not a constant. */
  expires_in: number
}

export type IdokladEnvelope<T> = {
  Data: T
  IsSuccess: boolean
  Message: string
  StatusCode: number
  ErrorCode: number
}

export type IdokladPagedList<T> = {
  Items: T[]
  TotalItems?: number
  TotalPages?: number
}

export type IdokladContact = {
  Id: number
  CompanyName: string
  Email?: string | null
  Firstname?: string | null
  Surname?: string | null
  Street?: string | null
  City?: string | null
  PostalCode?: string | null
  CountryId?: number | null
  Phone?: string | null
  Mobile?: string | null
}

export type IdokladContactPayload = {
  CompanyName: string
  Email?: string
  Firstname?: string
  Surname?: string
  Street?: string
  City?: string
  PostalCode?: string
  CountryId?: number
  Mobile?: string
}

export type IdokladCountry = {
  Id: number
  Code: string
  Name?: string
}

export type IdokladCurrency = {
  Id: number
  Code: string
}

export type IdokladPaymentOption = {
  Id: number
  Code?: string | null
  Name?: string | null
  IsDefault?: boolean
}

/** PriceType: 0 = WithVat, 1 = WithoutVat, 2 = OnlyBase. */
export const PRICE_TYPE_WITH_VAT = 0
/** VatRateType: 0 = Reduced1, 1 = Basic, 2 = Zero. */
export const VAT_RATE_TYPE_BASIC = 1
export const VAT_RATE_TYPE_ZERO = 2
/** ItemType: 0 = normal invoice line. */
export const ITEM_TYPE_NORMAL = 0
/** ReportLanguage / Pdf language: 1 = Czech. */
export const REPORT_LANGUAGE_CZ = 1

export type IdokladInvoiceItemPayload = {
  Name: string
  Amount: number
  UnitPrice: number
  Unit?: string
  PriceType: number
  VatRateType: number
  IsTaxMovement: boolean
  DiscountPercentage: number
  ItemType?: number
}

/**
 * What `IssuedInvoices/Default` hands back — an invoice pre-filled from the
 * agenda settings. We merge our own fields over it and POST the result.
 */
export type IdokladInvoiceDefault = {
  CurrencyId: number
  DateOfIssue: string
  DateOfMaturity: string
  DateOfTaxing: string
  DocumentSerialNumber: number
  NumericSequenceId: number
  PaymentOptionId: number
  IsEet?: boolean
  IsIncomeTax?: boolean
  VatRegime?: number
  [key: string]: unknown
}

export type IdokladInvoicePayload = {
  CurrencyId: number
  DateOfIssue: string
  DateOfMaturity: string
  DateOfTaxing: string
  Description: string
  DocumentSerialNumber: number
  IsEet: boolean
  IsIncomeTax: boolean
  Items: IdokladInvoiceItemPayload[]
  NumericSequenceId: number
  OrderNumber?: string
  PartnerId: number
  PaymentOptionId: number
  VariableSymbol?: string
  Note?: string
}

export type IdokladIssuedInvoice = {
  Id: number
  DocumentNumber: string
  DateOfIssue?: string
  /** PaymentStatus: 0 = Unpaid, 1 = Paid, 2 = PartialPaid, 3 = Overpaid. */
  PaymentStatus?: number
  Prices?: {
    TotalWithVat?: number
    TotalPaid?: number
  }
  [key: string]: unknown
}

/**
 * The `order.metadata.idoklad_*` keys — the single source of truth for
 * idempotency (FINISHINGTODOLIST §1: „nikdy dvakrát").
 */
export const IDOKLAD_METADATA_KEYS = {
  invoiceId: "idoklad_invoice_id",
  invoiceNumber: "idoklad_invoice_number",
  pdfUrl: "idoklad_invoice_pdf_url",
  issuedAt: "idoklad_invoice_issued_at",
  paidAt: "idoklad_invoice_paid_at",
  error: "idoklad_invoice_error",
} as const

export type IdokladInvoiceState = {
  invoice_id: number | null
  invoice_number: string | null
  pdf_url: string | null
  issued_at: string | null
  paid_at: string | null
  error: string | null
}
