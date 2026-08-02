import { createHash, timingSafeEqual } from "node:crypto"

export const COMGATE_API_URL = "https://payments.comgate.cz/v2.0"

export type ComgatePaymentStatus =
  | "PENDING"
  | "PAID"
  | "CANCELLED"
  | "AUTHORIZED"

export type ComgatePaymentDetails = {
  code: number | string
  message: string
  test: boolean | string
  price: number | string
  curr: string
  label: string
  refId: string
  method?: string
  email?: string
  phone?: string
  transId: string
  status: ComgatePaymentStatus
  paymentErrorReason?: string
  [key: string]: unknown
}

type ComgateRequestOptions = {
  merchant?: string
  secret?: string
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: Record<string, unknown>
  timeoutMs?: number
}

export class ComgateApiError extends Error {
  readonly code?: number
  readonly httpStatus?: number

  constructor(
    message: string,
    options: { code?: number; httpStatus?: number; cause?: unknown } = {}
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = "ComgateApiError"
    this.code = options.code
    this.httpStatus = options.httpStatus
  }
}

const methodPattern = /^[A-Z0-9][A-Z0-9_.+-]{0,127}$/
const transactionIdPattern = /^[A-Z0-9-]{1,80}$/i
const countryPattern =
  /^(ALL|AT|BE|CY|CZ|DE|EE|EL|ES|FI|FR|GB|HR|HU|IE|IT|LT|LU|LV|MT|NL|NO|PL|PT|RO|SI|SK|SE|US)$/

const amountLimits: Record<string, { min: number; max: number }> = {
  CZK: { min: 100, max: 100_000_000 },
  EUR: { min: 10, max: 4_000_000 },
  PLN: { min: 100, max: 17_000_000 },
  HUF: { min: 10_000, max: 1_250_000_000 },
  USD: { min: 100, max: 4_500_000 },
  GBP: { min: 100, max: 3_500_000 },
  RON: { min: 500, max: 19_000_000 },
  HRK: { min: 100, max: 2_147_483_647 },
  NOK: { min: 50, max: 40_000_000 },
  SEK: { min: 50, max: 39_000_000 },
}

export const resolveComgateMethod = (
  value: unknown,
  fallback = "ALL"
): string => {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim().toUpperCase()
  return methodPattern.test(normalized) ? normalized : fallback
}

export const resolveComgateTestMode = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value
  }

  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  )
}

export const resolveComgateCountry = (
  value: unknown,
  fallback = "CZ"
): string => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
  return countryPattern.test(normalized) ? normalized : fallback
}

export const createComgateAuthorization = (
  merchant?: string,
  secret?: string
): string => {
  if (!merchant || !secret) {
    throw new Error("Comgate credentials are not configured")
  }

  return `Basic ${Buffer.from(`${merchant}:${secret}`).toString("base64")}`
}

export const resolveStorefrontReturnUrl = (
  storefrontUrl: string | undefined,
  path: unknown,
  fallbackPath: string
): string => {
  if (!storefrontUrl) {
    throw new Error("STOREFRONT_PUBLIC_URL is required for Comgate payments")
  }

  const base = new URL(storefrontUrl)
  if (!['http:', 'https:'].includes(base.protocol)) {
    throw new Error("STOREFRONT_PUBLIC_URL must use HTTP or HTTPS")
  }

  const requestedPath =
    typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
      ? path
      : fallbackPath

  return new URL(requestedPath, base).toString()
}

export const resolveComgateTransactionId = (
  data: Record<string, unknown> | undefined
): string | null => {
  if (!data) return null

  for (const key of ["transId", "id", "payment_id", "paymentId"]) {
    const candidate = data[key]
    if (
      typeof candidate === "string" &&
      transactionIdPattern.test(candidate.trim())
    ) {
      return candidate.trim()
    }
  }

  return null
}

export const toComgateMinorUnits = (
  amount: unknown,
  currencyCode: string
): number => {
  const candidate =
    amount && typeof amount === "object"
      ? (amount as Record<string, unknown>)
      : undefined
  const numeric = Number(candidate?.numeric ?? candidate?.value ?? amount)
  const currency = currencyCode.toUpperCase()
  const limits = amountLimits[currency]

  if (!limits || !Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Unsupported or invalid Comgate amount for ${currency}`)
  }

  const minor = Math.round(numeric * 100)
  if (!Number.isSafeInteger(minor) || Math.abs(minor / 100 - numeric) > 1e-8) {
    throw new Error(`Comgate amount has too many decimal places for ${currency}`)
  }

  if (minor < limits.min || minor > limits.max) {
    throw new Error(`Comgate amount is outside the supported ${currency} range`)
  }

  if (currency === "HUF" && minor % 100 !== 0) {
    throw new Error("Comgate HUF amounts must be whole forints")
  }

  return minor
}

export const fromComgateMinorUnits = (amount: unknown): string => {
  const minor = Number(amount)
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new Error("Comgate returned an invalid payment amount")
  }

  return (minor / 100).toFixed(2).replace(/\.00$/, "")
}

export const secureCompare = (received: unknown, expected: unknown): boolean => {
  const receivedDigest = createHash("sha256")
    .update(String(received ?? ""))
    .digest()
  const expectedDigest = createHash("sha256")
    .update(String(expected ?? ""))
    .digest()

  return timingSafeEqual(receivedDigest, expectedDigest)
}

export const parseComgateStatus = (value: unknown): ComgatePaymentStatus => {
  const normalized = String(value ?? "").trim().toUpperCase()
  if (
    normalized === "PENDING" ||
    normalized === "PAID" ||
    normalized === "CANCELLED" ||
    normalized === "AUTHORIZED"
  ) {
    return normalized
  }

  throw new Error(`Unsupported Comgate payment status: ${normalized || "empty"}`)
}

export const resolveComgateExpirationTime = (
  value: unknown
): string | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined
  }

  const normalized = String(value).trim().toLowerCase()
  const match = /^([1-9][0-9]*)(m|h|d)$/.exec(normalized)
  if (!match) {
    throw new Error("Invalid Comgate expirationTime")
  }

  const quantity = Number(match[1])
  const minutes =
    match[2] === "d" ? quantity * 1_440 : match[2] === "h" ? quantity * 60 : quantity

  // Comgate accepts custom expiration between 30 minutes and seven days.
  if (!Number.isSafeInteger(minutes) || minutes < 30 || minutes > 10_080) {
    throw new Error("Comgate expirationTime must be between 30m and 7d")
  }

  return normalized
}

export const requestComgateJson = async <T extends Record<string, unknown>>(
  path: string,
  options: ComgateRequestOptions
): Promise<T> => {
  if (!path.startsWith("/")) {
    throw new Error("Comgate API path must be absolute")
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000)

  try {
    const response = await fetch(`${COMGATE_API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: createComgateAuthorization(
          options.merchant,
          options.secret
        ),
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })

    const raw = await response.text()
    let payload: Record<string, unknown> = {}
    if (raw) {
      try {
        payload = JSON.parse(raw) as Record<string, unknown>
      } catch (error) {
        throw new ComgateApiError("Comgate returned an invalid JSON response", {
          httpStatus: response.status,
          cause: error,
        })
      }
    }

    const code = payload.code == null ? undefined : Number(payload.code)
    if (!response.ok || (code !== undefined && code !== 0)) {
      throw new ComgateApiError(
        typeof payload.message === "string" && payload.message
          ? `Comgate request failed: ${payload.message}`
          : `Comgate request failed with HTTP ${response.status}`,
        {
          code: Number.isFinite(code) ? code : undefined,
          httpStatus: response.status,
        }
      )
    }

    return payload as T
  } catch (error) {
    if (error instanceof ComgateApiError) {
      throw error
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ComgateApiError(
        "Comgate request timed out; the transaction result is unknown",
        { cause: error }
      )
    }

    throw new ComgateApiError(
      "Comgate request failed; the transaction result is unknown",
      { cause: error }
    )
  } finally {
    clearTimeout(timeout)
  }
}
