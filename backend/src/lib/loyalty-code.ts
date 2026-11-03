import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { NEWSLETTER_MODULE } from "../modules/newsletter"
import { customerCountryOf, customerLocaleOf } from "./customer-locale"
import { emailLocaleForOrder, sendCustomerEmail, storeLink } from "./customer-email"
import type { EmailLocale } from "./email-locale"
import { getMerchantSettings } from "./merchant-settings"
import { newsletterUnsubscribeUrl, normalizeEmail } from "./newsletter-link"
import {
  isEligibleRecipient,
  subscriberState,
  type NewsletterRecipientCandidate,
  type SubscriberState,
} from "./newsletter-recipients"
import {
  autoCampaignIdentifier,
  buildLoyaltyPromotion,
  DAY_MS,
  loyaltyCampaignPrefix,
  loyaltyCodeState,
  loyaltyEmailKey,
  makeLoyaltyCode,
  manualCampaignIdentifier,
  normalizeLoyaltySettings,
  type LoyaltyCodeSettings,
  type LoyaltyCodeState,
} from "./loyalty-code-rules"

/**
 * Slevový kód pro stálého zákazníka — práce s moduly (akce, zákazníci,
 * newsletter, e-mail). Pravidla a jejich důvody jsou v `loyalty-code-rules.ts`.
 *
 * Volají to tři místa: ruční „Poslat slevový kód" na kartě zákazníka
 * (`api/admin/workbench/customers/:id/loyalty-code`), starší cesta
 * „Poděkovat" (`…/thank-you`, dnes jen přesměrovaná sem) a automat po
 * zaplacené objednávce (`subscribers/loyalty-code-auto.ts`).
 */

export const LOYALTY_EMAIL_TEMPLATE = "loyalty-code"

/** Nastavení kódu z nastavení obchodu; nečitelné = výchozí (automat vypnutý). */
export const getLoyaltySettings = async (
  container: MedusaContainer
): Promise<LoyaltyCodeSettings> => {
  try {
    const settings = await getMerchantSettings(container)
    return normalizeLoyaltySettings((settings as Record<string, unknown>).loyalty_code)
  } catch {
    return normalizeLoyaltySettings(undefined)
  }
}

export type LoyaltyPerson = {
  /** Záznam, ke kterému patří kampaně (účet, jinak nejstarší host). */
  anchorId: string
  /** Všechny záznamy se stejným e-mailem — pravidlo kódu je pustí všechny. */
  customerIds: string[]
  email: string | null
  registered: boolean
  name: string | null
  /** Záznam, podle kterého se volí jazyk a země e-mailu. */
  primary: any
}

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`)

/**
 * Člověk za záznamem zákazníka — hosté mají záznam na každý nákup, účet je
 * další záznam se stejnou adresou. Kód se váže na všechny, aby zákazník
 * nemusel řešit, „pod kterým" nakupuje.
 */
export const loadLoyaltyPerson = async (
  container: MedusaContainer,
  input: { customerId?: string | null; email?: string | null }
): Promise<LoyaltyPerson | null> => {
  const customerModule = container.resolve(Modules.CUSTOMER) as any
  let email = input.email ? normalizeEmail(input.email) : null
  let seed: any = null
  if (input.customerId) {
    ;[seed] = (await customerModule.listCustomers({ id: input.customerId }, { take: 1 })) as any[]
    if (seed?.email) email = normalizeEmail(String(seed.email))
  }
  const records: any[] = email
    ? ((await customerModule.listCustomers(
        { email: { $ilike: escapeLike(email) } },
        { take: 50 }
      )) as any[])
    : seed
      ? [seed]
      : []
  if (seed && !records.some((record) => record.id === seed.id)) records.push(seed)
  if (!records.length) return null

  const byAge = [...records].sort((a, b) =>
    String(a.created_at ?? "") < String(b.created_at ?? "") ? -1 : 1
  )
  const account = byAge.find((record) => record.has_account)
  const anchor = account ?? byAge[0]
  const named = [account, seed, ...byAge].find(
    (record) => record && (record.first_name || record.last_name)
  )
  return {
    anchorId: anchor.id,
    customerIds: byAge.map((record) => record.id),
    email,
    registered: Boolean(account),
    name: named ? [named.first_name, named.last_name].filter(Boolean).join(" ").trim() || null : null,
    primary: account ?? seed ?? anchor,
  }
}

export type NewsletterStatus = { state: SubscriberState | null; eligible: boolean }

/** Odebírá newsletter (potvrzeně a neodhlásil se)? Bez adresy / bez záznamu = ne. */
export const loadNewsletterStatus = async (
  container: MedusaContainer,
  email: string | null | undefined
): Promise<NewsletterStatus> => {
  const address = email ? normalizeEmail(email) : ""
  if (!address) return { state: null, eligible: false }
  const newsletter = container.resolve(NEWSLETTER_MODULE) as any
  const [subscriber] = (await newsletter.listNewsletterSubscribers(
    { email: address },
    { take: 1 }
  )) as NewsletterRecipientCandidate[]
  if (!subscriber) return { state: null, eligible: false }
  return { state: subscriberState(subscriber), eligible: isEligibleRecipient(subscriber) }
}

/** Proč kód poslat nejde — věta pro majitelku, nebo `null`. */
export const manualBlockReason = (
  person: LoyaltyPerson | null,
  newsletter: NewsletterStatus
): string | null => {
  if (!person?.email) return "Zákazník nemá e-mailovou adresu."
  if (!newsletter.eligible) {
    return newsletter.state === "pending"
      ? "Zákazník se přihlásil k newsletteru, ale odběr zatím nepotvrdil. Slevový kód posíláme jen potvrzeným odběratelům."
      : newsletter.state === "unsubscribed"
        ? "Zákazník se z newsletteru odhlásil. Slevový kód mu poslat nesmíme."
        : "Zákazník neodebírá newsletter. Slevový kód posíláme jen odběratelům (je to obchodní sdělení)."
  }
  return null
}

export type IssuedLoyaltyCode = {
  code: string
  percentage: number | null
  kind: "auto" | "manual"
  created_at: string | null
  ends_at: string | null
  state: LoyaltyCodeState
}

const isDuplicateError = (error: unknown): boolean =>
  /exists|duplicate|unique/i.test(String((error as any)?.message ?? ""))

const campaignRelations = ["budget", "promotions", "promotions.application_method"]

/** Kódy, které člověk už dostal (karta zákazníka), nejnovější první. */
export const listIssuedLoyaltyCodes = async (
  container: MedusaContainer,
  person: LoyaltyPerson
): Promise<IssuedLoyaltyCode[]> => {
  const promotionModule = container.resolve(Modules.PROMOTION) as any
  const prefix = loyaltyCampaignPrefix(person.anchorId)
  const filters: any[] = [{ campaign_identifier: { $like: `${escapeLike(prefix)}%` } }]
  // Kódy ze starého „Poděkovat" — kampaň nesla jen e-mail v názvu.
  if (person.email) filters.push({ name: `Poděkování — ${person.email}` })
  const campaigns = (await promotionModule.listCampaigns(
    { $or: filters },
    { relations: campaignRelations, take: 50, order: { created_at: "DESC" } }
  )) as any[]
  return campaigns.map((campaign) => {
    const promotion = (campaign.promotions ?? [])[0]
    const value = Number(promotion?.application_method?.value)
    return {
      code: String(promotion?.code ?? ""),
      percentage: Number.isFinite(value) ? value : null,
      kind: String(campaign.campaign_identifier ?? "").startsWith(`${prefix}po-`) ? "auto" : "manual",
      created_at: campaign.created_at ? new Date(campaign.created_at).toISOString() : null,
      ends_at: campaign.ends_at ? new Date(campaign.ends_at).toISOString() : null,
      // Kód ze starého „Poděkovat" vznikl jako koncept a obchod ho nepřijal.
      state: promotion && promotion.status !== "active" ? "expired" : loyaltyCodeState(campaign),
    }
  })
}

const existingCampaign = async (container: MedusaContainer, identifier: string): Promise<any | null> => {
  const promotionModule = container.resolve(Modules.PROMOTION) as any
  const [campaign] = (await promotionModule.listCampaigns(
    { campaign_identifier: identifier },
    { relations: campaignRelations, take: 1 }
  )) as any[]
  return campaign ?? null
}

/** Je pro tuhle hranici už automatický kód? */
export const autoCodeIssued = async (
  container: MedusaContainer,
  person: LoyaltyPerson,
  afterOrders: number
): Promise<boolean> =>
  Boolean(await existingCampaign(container, autoCampaignIdentifier(person.anchorId, afterOrders)))

export type CreatedLoyaltyCode = {
  code: string
  percentage: number
  endsAt: Date
  identifier: string
  /** false = automatický kód pro tuhle hranici už existoval (vrací se ten). */
  created: boolean
}

/**
 * Založí jednorázový kód jen pro tohoto člověka. Automatický kód
 * (`afterOrders`) má pevný identifikátor kampaně — když už existuje, vrátí se
 * ten a nic nového nevznikne.
 */
export const createLoyaltyCode = async (
  container: MedusaContainer,
  input: {
    person: LoyaltyPerson
    percentage: number
    validDays: number
    afterOrders?: number
    now?: Date
  }
): Promise<CreatedLoyaltyCode> => {
  const promotionModule = container.resolve(Modules.PROMOTION) as any
  const startsAt = input.now ?? new Date()
  const endsAt = new Date(startsAt.getTime() + input.validDays * DAY_MS)
  const fixedIdentifier =
    input.afterOrders !== undefined
      ? autoCampaignIdentifier(input.person.anchorId, input.afterOrders)
      : null

  const fromExisting = (campaign: any): CreatedLoyaltyCode => {
    const promotion = (campaign.promotions ?? [])[0]
    return {
      code: String(promotion?.code ?? ""),
      percentage: Number(promotion?.application_method?.value) || input.percentage,
      endsAt: campaign.ends_at ? new Date(campaign.ends_at) : endsAt,
      identifier: campaign.campaign_identifier,
      created: false,
    }
  }

  if (fixedIdentifier) {
    const campaign = await existingCampaign(container, fixedIdentifier)
    if (campaign) return fromExisting(campaign)
  }

  const label = input.person.email ?? input.person.anchorId
  // Kód je krátký a náhodný, takže „obsazeno" je vzácné, ale možné.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeLoyaltyCode()
    const identifier = fixedIdentifier ?? manualCampaignIdentifier(input.person.anchorId, code)
    try {
      await promotionModule.createPromotions([
        buildLoyaltyPromotion({
          code,
          percentage: input.percentage,
          startsAt,
          endsAt,
          customerIds: input.person.customerIds,
          campaignIdentifier: identifier,
          campaignName:
            input.afterOrders !== undefined
              ? `Kód po ${input.afterOrders}. nákupu — ${label}`
              : `Kód pro zákazníka — ${label}`,
        }),
      ])
      return { code, percentage: input.percentage, endsAt, identifier, created: true }
    } catch (error) {
      if (!isDuplicateError(error)) throw error
      // Souběh dvou plateb: automatický kód mezitím založil druhý běh.
      if (fixedIdentifier) {
        const campaign = await existingCampaign(container, fixedIdentifier)
        if (campaign) return fromExisting(campaign)
      }
    }
  }
  throw new MedusaError(
    MedusaError.Types.UNEXPECTED_STATE,
    "Nepodařilo se vytvořit jedinečný kód. Zkuste to prosím znovu."
  )
}

/** Jazyk e-mailu: jazyk zákazníka z registrace, jinak jazyk objednávky, jinak čeština. */
export const loyaltyEmailLocale = async (
  container: MedusaContainer,
  person: LoyaltyPerson,
  orderId?: string | null
): Promise<EmailLocale> =>
  customerLocaleOf(person.primary) ??
  (orderId ? await emailLocaleForOrder(container, orderId) : "cs")

/** Data šablony `loyalty-code` — sdílí je odeslání i náhled v adminu. */
export const loyaltyEmailData = (input: {
  person: LoyaltyPerson
  code: string
  percentage: number
  endsAt: Date
}): Record<string, unknown> => {
  const shop = storeLink()
  const unsubscribe = input.person.email ? newsletterUnsubscribeUrl(input.person.email) : null
  const country = customerCountryOf(input.person.primary)
  return {
    customerName: input.person.name ?? undefined,
    code: input.code,
    percentage: input.percentage,
    expiresAt: input.endsAt.toISOString(),
    registered: input.person.registered,
    ...(shop ? { shopLink: shop } : {}),
    ...(unsubscribe ? { unsubscribeLink: unsubscribe } : {}),
    ...(country ? { link_country: country } : {}),
  }
}

/** Pošle kód e-mailem. Klíč = kampaň, takže tentýž kód nikdy nedojde dvakrát. */
export const sendLoyaltyCodeEmail = async (
  container: MedusaContainer,
  input: {
    person: LoyaltyPerson
    code: CreatedLoyaltyCode
    orderId?: string | null
  }
): Promise<boolean> => {
  const locale = await loyaltyEmailLocale(container, input.person, input.orderId)
  return sendCustomerEmail(container, {
    template: LOYALTY_EMAIL_TEMPLATE,
    to: input.person.email,
    key: loyaltyEmailKey(input.code.identifier),
    orderId: input.orderId ?? null,
    locale,
    data: loyaltyEmailData({
      person: input.person,
      code: input.code.code,
      percentage: input.code.percentage,
      endsAt: input.code.endsAt,
    }),
  })
}

/**
 * Ruční kód z karty zákazníka: kontrola newsletteru, založení, odeslání.
 * Kontrola je tady, ne až v tlačítku — tlačítko se dá obejít, server ne.
 */
export const issueManualLoyaltyCode = async (
  container: MedusaContainer,
  input: { customerId: string; percentage: number; validDays: number }
): Promise<{ code: CreatedLoyaltyCode; sentTo: string }> => {
  const person = await loadLoyaltyPerson(container, { customerId: input.customerId })
  if (!person) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Zákazník nebyl nalezen.")
  }
  const blocked = manualBlockReason(person, await loadNewsletterStatus(container, person.email))
  if (blocked) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, blocked)
  }
  const code = await createLoyaltyCode(container, {
    person,
    percentage: input.percentage,
    validDays: input.validDays,
  })
  await sendLoyaltyCodeEmail(container, { person, code })
  container
    .resolve(ContainerRegistrationKeys.LOGGER)
    .info(`[slevový kód] Ruční kód ${code.code} (${code.percentage} %) odeslán na ${person.email}.`)
  return { code, sentTo: person.email as string }
}
