import * as React from "react"
import {
  DEFAULT_EMAIL_LOCALE,
  formatEmailDate,
  intlLocale,
  pick,
  type EmailLocale,
  type Localized,
} from "../../../lib/email-locale"

/**
 * Jazyk vykreslovaného e-mailu — kontext, ne props.
 *
 * Stejný důvod jako u právních údajů v patičce (`EmailLegalFactsContext`):
 * šablon je přes padesát a všechny sdílí `EmailLayout`, `Greeting`,
 * `Signature`… Jazyk by jinak musel projít každou komponentou. Resend
 * provider přečte `data.locale` a obalí jím vykreslený e-mail
 * (`withEmailLocale`). Bez kontextu (náhledy, testy, staré notifikace
 * bez `locale`) je e-mail česky — tak, jak byl vždycky.
 *
 * Texty šablon žijí u šablony jako `Localized<…>` objekt (všechny čtyři
 * jazyky povinně, TypeScript chybějící jazyk nepustí) a šablona si je
 * vezme přes `useCopy`. Kopie celých šablon po jazycích by se rozjely
 * při první úpravě rozvržení.
 */
export const EmailLocaleContext = React.createContext<EmailLocale>(DEFAULT_EMAIL_LOCALE)

/** Obalí e-mail jazykem; čeština (výchozí) obal nepotřebuje. */
export const withEmailLocale = (
  email: React.ReactNode,
  locale: EmailLocale | null | undefined
): React.ReactNode =>
  locale && locale !== DEFAULT_EMAIL_LOCALE ? (
    <EmailLocaleContext.Provider value={locale}>{email}</EmailLocaleContext.Provider>
  ) : (
    email
  )

export const useEmailLocale = (): EmailLocale => React.useContext(EmailLocaleContext)

/**
 * Vlastní znění z administrace → Emaily (15. 11. 2026). Platí jen pro texty
 * TÉ šablony, která se vykresluje (`copy` je její objekt `COPY` — porovnává se
 * identita, ať se nepřepíšou společné texty patičky nebo podpisu), jen česky
 * a jen u textových polí. Prázdný text = výchozí znění.
 */
export type EmailTextOverrides = {
  copy: Localized<Record<string, unknown>> | null
  values: Record<string, string>
}

export const EmailTextOverridesContext = React.createContext<EmailTextOverrides | null>(null)

export const withEmailTextOverrides = (
  email: React.ReactNode,
  overrides: EmailTextOverrides | null | undefined
): React.ReactNode =>
  overrides?.copy && Object.keys(overrides.values ?? {}).length ? (
    <EmailTextOverridesContext.Provider value={overrides}>{email}</EmailTextOverridesContext.Provider>
  ) : (
    email
  )

/** Texty šablony v jazyce e-mailu (s vlastním zněním z administrace). */
export const useCopy = <T,>(copy: Localized<T>): T => {
  const locale = useEmailLocale()
  const overrides = React.useContext(EmailTextOverridesContext)
  const base = pick(locale, copy)
  if (
    locale !== DEFAULT_EMAIL_LOCALE ||
    !overrides ||
    (overrides.copy as unknown) !== (copy as unknown)
  ) {
    return base
  }
  const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(overrides.values)) {
    if (typeof merged[key] === "string" && typeof value === "string" && value.trim()) {
      merged[key] = value
    }
  }
  return merged as T
}

/** Datum podle jazyka e-mailu — pro šablony, které formátují samy. */
export const useFormatDate = () => {
  const locale = useEmailLocale()
  return (value: unknown, options?: Intl.DateTimeFormatOptions) =>
    formatEmailDate(value, locale, options)
}

/** `Intl` locale e-mailu („sk-SK"…) — pro `Intl.NumberFormat` v šablonách. */
export const useIntlLocale = (): string => intlLocale(useEmailLocale())
