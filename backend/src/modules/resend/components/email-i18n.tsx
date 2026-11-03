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

/** Texty šablony v jazyce e-mailu. */
export const useCopy = <T,>(copy: Localized<T>): T => pick(useEmailLocale(), copy)

/** Datum podle jazyka e-mailu — pro šablony, které formátují samy. */
export const useFormatDate = () => {
  const locale = useEmailLocale()
  return (value: unknown, options?: Intl.DateTimeFormatOptions) =>
    formatEmailDate(value, locale, options)
}

/** `Intl` locale e-mailu („sk-SK"…) — pro `Intl.NumberFormat` v šablonách. */
export const useIntlLocale = (): string => intlLocale(useEmailLocale())
