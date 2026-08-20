import { isEmpty } from "./isEmpty"

type ConvertToLocaleParams = {
  amount: number
  currency_code: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  locale?: string
}

export const convertToLocale = ({
  amount,
  currency_code,
  minimumFractionDigits,
  maximumFractionDigits,
  // Czech shop, Czech formatting — the en-US default printed „€5.00" where
  // a Slovak customer expects „5,00 €". Callers can still override.
  locale = "cs-CZ",
}: ConvertToLocaleParams) => {
  if (currency_code && !isEmpty(currency_code)) {
    const code = currency_code.toString().toUpperCase()

    // Special-case for Czech koruna: format as integer with grouping and
    // append ',-' (e.g. 1 234,-)
    if (code === "CZK") {
      const fmt = new Intl.NumberFormat("cs-CZ", {
        style: "decimal",
        minimumFractionDigits: minimumFractionDigits ?? 0,
        maximumFractionDigits: maximumFractionDigits ?? 0,
      }).format(amount)

      return `${fmt},-`
    }

    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency_code,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount)
  }

  return amount.toString()
}
