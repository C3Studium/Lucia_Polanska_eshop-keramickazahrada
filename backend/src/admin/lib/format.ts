/**
 * Shared display formatting for the admin extensions.
 *
 * ## Why this is custom code
 *
 * Medusa's dashboard has exactly these helpers (`getStylizedAmount`,
 * `getLocaleAmount` in `@medusajs/dashboard/src/lib/money-amount-helpers.ts`), but they
 * are **not** part of the package's public API — `@medusajs/dashboard` only exports
 * `LayoutComposer`, `ConfigurableDataTable`, `createTableAdapter` and
 * `defineCellRenderer`. Importing from `@medusajs/dashboard/src/...` would reach into
 * package internals and break on any minor upgrade, so a local helper is the
 * upgrade-safe choice.
 *
 * Behaviour deliberately matches Medusa's: the fraction digits come from the currency
 * itself (via `Intl`), never a hardcoded value, so non-CZK currencies render correctly.
 */

const CZ_LOCALE = "cs-CZ"

export const formatAmount = (
  amount?: number | string | null,
  currencyCode?: string | null
): string => {
  if (amount === undefined || amount === null || amount === "") {
    return "—"
  }
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount)) {
    return "—"
  }
  return new Intl.NumberFormat(CZ_LOCALE, {
    style: "currency",
    currency: (currencyCode || "CZK").toUpperCase(),
  }).format(numericAmount)
}

export const formatDateTime = (value?: string | Date | null): string => {
  if (!value) {
    return "—"
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }
  return new Intl.DateTimeFormat(CZ_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
