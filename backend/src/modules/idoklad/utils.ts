import { toAmount } from "../../lib/ship-gate"
import {
  ITEM_TYPE_NORMAL,
  PRICE_TYPE_WITH_VAT,
  VAT_RATE_TYPE_BASIC,
  VAT_RATE_TYPE_ZERO,
  type IdokladContactPayload,
  type IdokladEnvelope,
  type IdokladInvoiceDefault,
  type IdokladInvoiceItemPayload,
  type IdokladInvoicePayload,
  type IdokladPaymentOption,
  type IdokladTokenResponse,
} from "./types"

export const IDOKLAD_API_URL = "https://api.idoklad.cz/v3"

/**
 * Two token endpoints exist. The documented v3 client-credentials flow runs
 * against the v2 identity endpoint and *requires* the `application_id` from
 * the Developer portal; the legacy endpoint predates the portal and takes only
 * client id + secret. Which one we call is decided by whether an application
 * id was configured — see `createTokenRequest`.
 */
export const IDOKLAD_TOKEN_URL_V2 =
  "https://identity.idoklad.cz/server/v2/connect/token"
export const IDOKLAD_TOKEN_URL_LEGACY =
  "https://identity.idoklad.cz/server/connect/token"

export class IdokladApiError extends Error {
  readonly httpStatus?: number
  readonly errorCode?: number

  constructor(
    message: string,
    options: { httpStatus?: number; errorCode?: number; cause?: unknown } = {}
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = "IdokladApiError"
    this.httpStatus = options.httpStatus
    this.errorCode = options.errorCode
  }
}

/** `true` for "true"/"1"/"yes"/"on" and boolean true — mirrors comgate's flag parsing. */
export const resolveBooleanOption = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value
  }
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  )
}

export const resolveNumericOption = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined
}

/**
 * A calendar date in Prague, as iDoklad wants it (`YYYY-MM-DD`). UTC would
 * flip an invoice issued after midnight CET to the previous day.
 */
export const pragueDate = (value?: string | Date | null): string => {
  const date = value ? new Date(value) : new Date()
  const source = Number.isNaN(date.getTime()) ? new Date() : date
  // sv-SE formats as ISO `YYYY-MM-DD`, which is the whole point of the locale.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(source)
}

export const round2 = (value: number): number => Math.round(value * 100) / 100

const truncate = (value: unknown, max: number): string =>
  String(value ?? "")
    .trim()
    .slice(0, max)

/** VariableSymbol allows at most 10 characters and only digits make sense. */
export const toVariableSymbol = (displayId: unknown): string | undefined => {
  const digits = String(displayId ?? "").replace(/\D/g, "").slice(0, 10)
  return digits.length ? digits : undefined
}

type TokenRequestInput = {
  clientId: string
  clientSecret: string
  applicationId?: string
}

export const createTokenRequest = (
  input: TokenRequestInput
): { url: string; body: URLSearchParams } => {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    scope: "idoklad_api",
  })

  if (input.applicationId) {
    body.set("application_id", input.applicationId)
    return { url: IDOKLAD_TOKEN_URL_V2, body }
  }

  return { url: IDOKLAD_TOKEN_URL_LEGACY, body }
}

export const requestIdokladToken = async (
  input: TokenRequestInput & { timeoutMs?: number }
): Promise<IdokladTokenResponse> => {
  const { url, body } = createTokenRequest(input)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 15_000)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
      signal: controller.signal,
    })

    const raw = await response.text()
    let payload: Record<string, unknown> = {}
    if (raw) {
      try {
        payload = JSON.parse(raw) as Record<string, unknown>
      } catch {
        // Non-JSON error body — the HTTP status carries the message below.
      }
    }

    if (!response.ok || typeof payload.access_token !== "string") {
      const detail =
        typeof payload.error === "string" ? ` (${payload.error})` : ""
      throw new IdokladApiError(
        `iDoklad: přihlášení k API selhalo, HTTP ${response.status}${detail}. Zkontrolujte IDOKLAD_CLIENT_ID, IDOKLAD_CLIENT_SECRET a IDOKLAD_APPLICATION_ID.`,
        { httpStatus: response.status }
      )
    }

    return payload as unknown as IdokladTokenResponse
  } catch (error) {
    if (error instanceof IdokladApiError) {
      throw error
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new IdokladApiError("iDoklad: požadavek o token vypršel.", {
        cause: error,
      })
    }
    throw new IdokladApiError("iDoklad: požadavek o token selhal.", {
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
  }
}

type IdokladRequestOptions = {
  token: string
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: Record<string, unknown>
  query?: Record<string, string | number | boolean | undefined>
  timeoutMs?: number
}

/**
 * One call against `api.idoklad.cz/v3`. Every endpoint answers with the
 * `{ Data, IsSuccess, Message, ... }` envelope; the caller gets `Data` and a
 * thrown {@link IdokladApiError} carrying iDoklad's own `Message` otherwise.
 */
export const requestIdokladJson = async <T>(
  path: string,
  options: IdokladRequestOptions
): Promise<T> => {
  if (!path.startsWith("/")) {
    throw new Error("iDoklad API path must be absolute")
  }

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) {
      query.set(key, String(value))
    }
  }
  const queryString = query.toString()
  const url = `${IDOKLAD_API_URL}${path}${queryString ? `?${queryString}` : ""}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000)

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })

    const raw = await response.text()
    let payload: Partial<IdokladEnvelope<T>> = {}
    if (raw) {
      try {
        payload = JSON.parse(raw) as IdokladEnvelope<T>
      } catch (error) {
        throw new IdokladApiError(
          `iDoklad: neplatná odpověď serveru (HTTP ${response.status}).`,
          { httpStatus: response.status, cause: error }
        )
      }
    }

    if (!response.ok || payload.IsSuccess === false) {
      const message =
        typeof payload.Message === "string" && payload.Message.trim().length
          ? payload.Message
          : `HTTP ${response.status}`
      throw new IdokladApiError(`iDoklad: ${message}`, {
        httpStatus: response.status,
        errorCode:
          typeof payload.ErrorCode === "number" ? payload.ErrorCode : undefined,
      })
    }

    return payload.Data as T
  } catch (error) {
    if (error instanceof IdokladApiError) {
      throw error
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new IdokladApiError(
        "iDoklad: požadavek vypršel; výsledek není známý.",
        { cause: error }
      )
    }
    throw new IdokladApiError("iDoklad: požadavek selhal.", { cause: error })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * The shape of a Medusa order this module maps from. Deliberately loose —
 * the orchestrator queries with `query.graph` and everything arrives as `any`;
 * the mapping functions below are the single place that names what they read.
 */
export type InvoiceOrderInput = {
  id: string
  display_id?: number | string
  email?: string | null
  currency_code?: string | null
  total?: unknown
  shipping_total?: unknown
  items?: Array<{
    title?: string | null
    product_title?: string | null
    product_id?: string | null
    quantity?: unknown
    total?: unknown
  }> | null
  shipping_methods?: Array<{ name?: string | null }> | null
  billing_address?: AddressLike | null
  shipping_address?: AddressLike | null
  customer?: { first_name?: string | null; last_name?: string | null } | null
}

type AddressLike = {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
}

const fullName = (address?: AddressLike | null): string =>
  [address?.first_name, address?.last_name].filter(Boolean).join(" ").trim()

/**
 * The customer as an iDoklad contact. `CompanyName` is the only required
 * field and doubles as the display name, so a private person's contact is
 * simply named "Jana Nováková".
 */
export const buildContactPayload = (
  order: InvoiceOrderInput,
  countryId?: number
): IdokladContactPayload => {
  const address = order.billing_address ?? order.shipping_address ?? {}
  const name =
    truncate(address.company, 200) ||
    truncate(fullName(address), 200) ||
    truncate(fullName({ ...order.customer }), 200) ||
    truncate(order.email, 200) ||
    "Zákazník e-shopu"

  const street = [address.address_1, address.address_2]
    .filter(Boolean)
    .join(", ")

  return {
    CompanyName: name,
    ...(order.email ? { Email: truncate(order.email, 254) } : {}),
    ...(address.first_name ? { Firstname: truncate(address.first_name, 50) } : {}),
    ...(address.last_name ? { Surname: truncate(address.last_name, 50) } : {}),
    ...(street ? { Street: truncate(street, 100) } : {}),
    ...(address.city ? { City: truncate(address.city, 50) } : {}),
    ...(address.postal_code
      ? { PostalCode: truncate(address.postal_code, 11) }
      : {}),
    ...(address.phone ? { Mobile: truncate(address.phone, 20) } : {}),
    ...(countryId ? { CountryId: countryId } : {}),
  }
}

/**
 * The VAT mapping, in one place (sprint brief §C.2).
 *
 * Lucia is not a VAT payer (neplátce DPH — FINISHINGTODOLIST §1), so the
 * default is `VatRateType: Zero`: the agenda is configured as a non-payer and
 * the document goes out with no VAT whatsoever. Should she ever register,
 * `IDOKLAD_VAT_PAYER=true` switches the lines to the basic rate while keeping
 * `PriceType: WithVat` — storefront prices are final consumer prices either
 * way, so the gross amounts never change, only how iDoklad splits them.
 */
export const vatRateTypeFor = (vatPayer: boolean): number =>
  vatPayer ? VAT_RATE_TYPE_BASIC : VAT_RATE_TYPE_ZERO

const invoiceLine = (
  name: string,
  amount: number,
  unitPrice: number,
  vatPayer: boolean,
  unit?: string
): IdokladInvoiceItemPayload => ({
  Name: truncate(name, 200) || "Položka",
  Amount: amount,
  UnitPrice: unitPrice,
  ...(unit ? { Unit: unit } : {}),
  PriceType: PRICE_TYPE_WITH_VAT,
  VatRateType: vatRateTypeFor(vatPayer),
  IsTaxMovement: false,
  DiscountPercentage: 0,
  ItemType: ITEM_TYPE_NORMAL,
})

/**
 * Order lines → invoice lines, guaranteed to sum to the order total.
 *
 * Discounts are already inside each item's `total`, so the per-unit price is
 * `total / quantity` rounded to haléře — and because that rounding can drift a
 * few haléřů from the order total, a final "Zaokrouhlení" line absorbs the
 * difference. The invoice always says exactly what the customer paid.
 *
 * Shipping is split into „Poštovné" + „Balné" when the packaging share is
 * known (checkout folds both into one shipping price — the invoice unfolds
 * them so the customer sees what they were told). When it is not known, one
 * honest combined line.
 */
export const buildInvoiceItems = (
  order: InvoiceOrderInput,
  vatPayer: boolean,
  options: { packagingCzk?: number | null } = {}
): IdokladInvoiceItemPayload[] => {
  const lines: IdokladInvoiceItemPayload[] = []

  for (const item of order.items ?? []) {
    const quantity = Math.max(1, Math.trunc(toAmount(item.quantity)) || 1)
    const total = toAmount(item.total)
    lines.push(
      invoiceLine(
        item.product_title || item.title || "Položka",
        quantity,
        round2(total / quantity),
        vatPayer,
        "ks"
      )
    )
  }

  const shippingTotal = round2(toAmount(order.shipping_total))
  if (shippingTotal > 0) {
    const methodName = (order.shipping_methods ?? [])[0]?.name
    const packaging =
      options.packagingCzk != null ? round2(options.packagingCzk) : null
    if (packaging !== null && packaging > 0 && packaging < shippingTotal) {
      lines.push(
        invoiceLine(
          methodName ? `Poštovné — ${methodName}` : "Poštovné",
          1,
          round2(shippingTotal - packaging),
          vatPayer
        )
      )
      lines.push(invoiceLine("Balné", 1, packaging, vatPayer))
    } else {
      lines.push(
        invoiceLine(
          methodName ? `Poštovné a balné — ${methodName}` : "Poštovné a balné",
          1,
          shippingTotal,
          vatPayer
        )
      )
    }
  }

  const orderTotal = round2(toAmount(order.total))
  const linesTotal = round2(
    lines.reduce((sum, line) => sum + line.UnitPrice * line.Amount, 0)
  )
  const drift = round2(orderTotal - linesTotal)
  if (Math.abs(drift) >= 0.01 && lines.length) {
    lines.push(invoiceLine("Zaokrouhlení", 1, drift, vatPayer))
  }

  return lines
}

type InvoicePayloadInput = {
  order: InvoiceOrderInput
  defaults: IdokladInvoiceDefault
  partnerId: number
  vatPayer: boolean
  paymentOptionId?: number
  numericSequenceId?: number
  currencyId?: number
  /** Balné share of the shipping price — splits Poštovné/Balné when known. */
  packagingCzk?: number | null
}

export const buildInvoicePayload = (
  input: InvoicePayloadInput
): IdokladInvoicePayload => {
  const { order, defaults } = input
  const today = pragueDate()
  const variableSymbol = toVariableSymbol(order.display_id)

  return {
    CurrencyId: input.currencyId ?? defaults.CurrencyId,
    DateOfIssue: today,
    DateOfTaxing: today,
    DateOfMaturity: defaults.DateOfMaturity || today,
    Description: `Objednávka #${order.display_id ?? order.id}`,
    DocumentSerialNumber: defaults.DocumentSerialNumber,
    // EET has been abolished; the flag stays required by the API.
    IsEet: false,
    IsIncomeTax: defaults.IsIncomeTax ?? true,
    Items: buildInvoiceItems(order, input.vatPayer, {
      packagingCzk: input.packagingCzk,
    }),
    NumericSequenceId: input.numericSequenceId ?? defaults.NumericSequenceId,
    OrderNumber: truncate(order.display_id ?? "", 25) || undefined,
    PartnerId: input.partnerId,
    PaymentOptionId: input.paymentOptionId ?? defaults.PaymentOptionId,
    ...(variableSymbol ? { VariableSymbol: variableSymbol } : {}),
    Note: "Vystaveno automaticky e-shopem Keramická zahrada.",
  }
}

const normalized = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

/**
 * Which of the agenda's payment options (způsoby úhrady) an order should carry.
 * Matched by name because the ids are per-agenda: dobírka orders look for
 * "dobírk…", online payments prefer "kart…" (card) and fall back to
 * "převod…" (bank transfer); anything unmatched keeps the agenda default.
 */
export const pickPaymentOptionId = (
  options: IdokladPaymentOption[],
  input: { cod: boolean; defaultId?: number }
): number | undefined => {
  const byNeedle = (needle: string): number | undefined =>
    options.find(
      (option) =>
        normalized(option.Name).includes(needle) ||
        normalized(option.Code).includes(needle)
    )?.Id

  if (input.cod) {
    return byNeedle("dobirk") ?? input.defaultId
  }

  return byNeedle("kart") ?? byNeedle("prevod") ?? input.defaultId
}
