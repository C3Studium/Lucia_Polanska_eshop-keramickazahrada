import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { parseEmailLocale, type EmailLocale } from "./email-locale"

/**
 * Jazyk e-mailů, které nejsou o objednávce — účet (ověření adresy, nové
 * heslo, vítejte, smazání účtu).
 *
 * Objednávka si jazyk nese v `metadata.locale` z košíku; zákazník bez
 * objednávky takovou stopu nemá. Storefront proto při registraci zapíše
 * do `customer.metadata` jazyk a zemi, ze které se registroval
 * (`locale`, `country_code` — podle přepínače zemí, stejné mapování jako
 * u košíku). Kdo se registroval dřív, nemá nic a dostává češtinu.
 */

type CustomerLike = { metadata?: Record<string, unknown> | null } | null | undefined

/** Jazyk zákazníka z metadat, nebo `null` (= nevíme, tedy česky). */
export const customerLocaleOf = (customer: CustomerLike): EmailLocale | null =>
  parseEmailLocale(customer?.metadata?.locale)

/** Země přepínače, ze které se zákazník registroval (`sk`, `de`…), nebo `null`. */
export const customerCountryOf = (customer: CustomerLike): string | null => {
  const value = customer?.metadata?.country_code
  return typeof value === "string" && /^[a-z]{2}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : null
}

/**
 * Zákazník podle e-mailu — u resetu hesla nic jiného nemáme. Účet s heslem
 * (`has_account`) má přednost před hostem se stejnou adresou z dřívější
 * objednávky. Nikdy nevyhodí: bez zákazníka je e-mail česky.
 */
export const customerByEmail = async (
  container: MedusaContainer,
  email: string | null | undefined
): Promise<any | null> => {
  const address = (email ?? "").trim()
  if (!address) return null
  try {
    const customers = (await container
      .resolve(Modules.CUSTOMER)
      .listCustomers({ email: address } as never)) as any[]
    return customers.find((customer) => customer?.has_account) ?? customers[0] ?? null
  } catch {
    return null
  }
}

/**
 * Odkaz na storefront v zemi zákazníka — `…/cz/reset-password` →
 * `…/sk/reset-password`. Odkazy staví `lib/storefront-url` vždy se zemí
 * z `STOREFRONT_COUNTRY`; Slovák by po kliknutí skončil v českém obchodě
 * s korunami. Bez známé země (nebo když odkaz segment nemá) se vrátí beze
 * změny.
 */
export const withCustomerCountry = (url: string, country: string | null | undefined): string => {
  const target = (country ?? "").trim().toLowerCase()
  const current = (process.env.STOREFRONT_COUNTRY || "cz").toLowerCase()
  if (!url || !target || target === current) return url
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split("/")
    if (segments[1]?.toLowerCase() !== current) return url
    segments[1] = target
    parsed.pathname = segments.join("/")
    return parsed.toString()
  } catch {
    return url
  }
}
