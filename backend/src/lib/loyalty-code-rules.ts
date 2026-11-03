/**
 * Slevový kód pro stálého zákazníka — pravidla bez frameworku.
 *
 * Jeden kód = jedna akce v modulu akcí Medusy: procento z objednávky, vlastní
 * kampaň s koncem platnosti a rozpočtem „použití 1" (limit použití v Meduse
 * žije na rozpočtu kampaně) a pravidlo `customer.id` — kód projde jen
 * v košíku, který patří některému záznamu téhož člověka (účet i dřívější
 * nákupy jako host se stejným e-mailem). Komukoli jinému ho Medusa
 * nepřizná, i když kód zná.
 *
 * Co kód smí zlevnit, rozhoduje Medusa podle `is_discountable` na řádku
 * košíku (`lib/discountable.ts`, `lib/packaging.ts`): výprodej, sezónní akce,
 * „Bez slev. kódů", dárkové poukazy, balné a doběrečné sleva nedostanou —
 * stejně jako u každého jiného slevového kódu v obchodě. Kód tu nic
 * nepřebíjí, je to obyčejný kód s omezením na jednoho člověka.
 *
 * Rozhodnutí 2. 11. 2026 (Matěj): poděkování se slevovým kódem je obchodní
 * sdělení a chodí jen potvrzeným odběratelům newsletteru — ruční i automatické.
 *
 * Čisté funkce — testuje je `__tests__/loyalty-code.unit.spec.ts`.
 */

export type LoyaltyCodeSettings = {
  /** Automat „po N. zaplacené objednávce" — výchozí vypnutý. */
  auto_enabled: boolean
  /** Po kolikáté zaplacené objednávce kód odejde. */
  after_orders: number
  /** Sleva v procentech (výchozí i pro ruční kód). */
  percentage: number
  /** Platnost kódu ve dnech (výchozí i pro ruční kód). */
  valid_days: number
}

export const LOYALTY_CODE_DEFAULTS: LoyaltyCodeSettings = {
  auto_enabled: false,
  after_orders: 3,
  percentage: 10,
  valid_days: 60,
}

/** Meze — překlep na klávesnici nesmí rozdat obchod. */
export const LOYALTY_LIMITS = {
  percentage: { min: 1, max: 50 },
  valid_days: { min: 1, max: 365 },
  after_orders: { min: 2, max: 50 },
} as const

/** Abeceda bez O/0 a I/1 — kód se opisuje z telefonu. */
export const LOYALTY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
export const LOYALTY_CODE_PREFIX = "DIKY-"
const SUFFIX_LENGTH = 6

/**
 * Nový kód `DIKY-XXXXXX`. Bez pomlčky má 10 znaků, takže ho obchod nikdy
 * nesplete s dárkovým poukazem (8 znaků, `looksLikeVoucherCode`) — poukaz
 * by v košíku přepnul balné na „smí dostat slevu".
 */
export const makeLoyaltyCode = (
  randomIndex: (max: number) => number = (max) => Math.floor(Math.random() * max)
): string => {
  let suffix = ""
  for (let index = 0; index < SUFFIX_LENGTH; index += 1) {
    suffix += LOYALTY_CODE_ALPHABET[randomIndex(LOYALTY_CODE_ALPHABET.length)]
  }
  return `${LOYALTY_CODE_PREFIX}${suffix}`
}

/**
 * Identifikátor kampaně. Patří k „kotevnímu" záznamu člověka (účet, jinak
 * nejstarší záznam hosta), aby karta zákazníka našla všechny jeho kódy
 * jedním dotazem podle předpony.
 *
 * Automatický kód má identifikátor **pevný** pro dvojici zákazník + hranice.
 * Identifikátor kampaně je v Meduse unikátní, takže druhý pokus (událost
 * doručená dvakrát, záloha a pak doplatek téže objednávky, dvě platby naráz)
 * druhý kód nezaloží — databáze to odmítne a automat jen znovu pošle
 * (nebo díky klíči nepošle) tentýž e-mail.
 */
export const loyaltyCampaignPrefix = (anchorId: string): string => `kz-kod-${anchorId}-`

export const autoCampaignIdentifier = (anchorId: string, afterOrders: number): string =>
  `${loyaltyCampaignPrefix(anchorId)}po-${afterOrders}`

export const manualCampaignIdentifier = (anchorId: string, code: string): string =>
  `${loyaltyCampaignPrefix(anchorId)}${code}`

/** Klíč e-mailu — opakované odeslání téhož kódu nepošle druhý e-mail. */
export const loyaltyEmailKey = (campaignIdentifier: string): string =>
  `loyalty-code:${campaignIdentifier}`

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const numeric = Math.round(Number(value))
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

/** Nastavení z `merchant-settings` (nebo cokoli) na platné hodnoty. */
export const normalizeLoyaltySettings = (raw: unknown): LoyaltyCodeSettings => {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  return {
    auto_enabled: source.auto_enabled === true,
    after_orders: clampInt(
      source.after_orders,
      LOYALTY_LIMITS.after_orders.min,
      LOYALTY_LIMITS.after_orders.max,
      LOYALTY_CODE_DEFAULTS.after_orders
    ),
    percentage: clampInt(
      source.percentage,
      LOYALTY_LIMITS.percentage.min,
      LOYALTY_LIMITS.percentage.max,
      LOYALTY_CODE_DEFAULTS.percentage
    ),
    valid_days: clampInt(
      source.valid_days,
      LOYALTY_LIMITS.valid_days.min,
      LOYALTY_LIMITS.valid_days.max,
      LOYALTY_CODE_DEFAULTS.valid_days
    ),
  }
}

export const DAY_MS = 24 * 60 * 60 * 1000

/** Vstup akce pro `promotionModule.createPromotions` — jedna akce na jeden kód. */
export const buildLoyaltyPromotion = (input: {
  code: string
  percentage: number
  startsAt: Date
  endsAt: Date
  /** Všechny záznamy zákazníka (účet + hosté se stejným e-mailem). */
  customerIds: string[]
  campaignIdentifier: string
  campaignName: string
}) => {
  const customerIds = [...new Set(input.customerIds.filter(Boolean))]
  if (!customerIds.length) {
    // Bez pravidla by kód platil pro kohokoli — to se stát nesmí.
    throw new Error("Slevový kód pro zákazníka potřebuje aspoň jeden záznam zákazníka.")
  }
  return {
    code: input.code,
    type: "standard" as const,
    // Výchozí stav akce v Meduse je „draft" — takový kód obchod odmítne
    // jako neplatný. Starý „Poděkovat" tím trpěl: kód odešel, ale nefungoval.
    status: "active" as const,
    is_automatic: false,
    application_method: {
      type: "percentage" as const,
      target_type: "order" as const,
      allocation: "across" as const,
      value: input.percentage,
    },
    rules: [
      {
        attribute: "customer.id",
        operator: "in" as const,
        values: customerIds,
      },
    ],
    campaign: {
      name: input.campaignName,
      campaign_identifier: input.campaignIdentifier,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      budget: { type: "usage" as const, limit: 1 },
    },
  }
}

type PaymentLike = { captured_at?: string | Date | null } | null | undefined
type PaymentCollectionLike =
  | { status?: string | null; payments?: PaymentLike[] | null }
  | null
  | undefined

export type PaidOrderLike = {
  id: string
  status?: string | null
  canceled_at?: string | Date | null
  payment_collections?: PaymentCollectionLike[] | null
}

/**
 * Je objednávka zaplacená? Nezrušená a s aspoň jednou zachycenou platbou
 * (u zakázky stačí záloha — nákup to je). Za zaplacenou se nepočítá
 * objednávka, kterou jen autorizovala karta nebo čeká dobírka.
 */
export const isPaidOrder = (order: PaidOrderLike | null | undefined): boolean => {
  if (!order?.id) return false
  if (order.status === "canceled" || order.canceled_at) return false
  return (order.payment_collections ?? []).some(
    (collection) =>
      collection?.status === "completed" ||
      collection?.status === "partially_captured" ||
      (collection?.payments ?? []).some((payment) => Boolean(payment?.captured_at))
  )
}

/** Počet zaplacených objednávek; každá objednávka jednou, i když přišla dvěma dotazy. */
export const paidOrderCount = (orders: Array<PaidOrderLike | null | undefined>): number => {
  const seen = new Set<string>()
  for (const order of orders) {
    if (order?.id && !seen.has(order.id) && isPaidOrder(order)) seen.add(order.id)
  }
  return seen.size
}

export type AutoLoyaltyInput = {
  settings: LoyaltyCodeSettings
  /** Zkušební režim obchodu (`lib/test-mode.ts`). */
  testMode: boolean
  /** Má člověk účet? (automat jen pro registrované). */
  registered: boolean
  email: string | null | undefined
  /** Potvrzený odběratel newsletteru, který se neodhlásil. */
  newsletterEligible: boolean
  paidOrders: number
  /** Kód pro tuhle hranici už existuje (kampaň s pevným identifikátorem). */
  alreadyIssued: boolean
}

export type AutoLoyaltySkipReason =
  | "disabled"
  | "test-mode"
  | "no-email"
  | "guest"
  | "not-yet"
  | "no-newsletter"
  | "already-issued"

/** `reason` je `null` právě tehdy, když se posílá. */
export type AutoLoyaltyDecision = { send: boolean; reason: AutoLoyaltySkipReason | null }

const skip = (reason: AutoLoyaltySkipReason): AutoLoyaltyDecision => ({ send: false, reason })

/**
 * Poslat automatický kód? Pořadí důvodů je i pořadí, v jakém je levné je
 * zjistit — automat se ptá postupně a u prvního „ne" skončí.
 *
 * „Po N. objednávce" = poprvé, kdy má zákazník N a víc zaplacených
 * objednávek. Kdo jich měl víc už ve chvíli zapnutí automatu, dostane kód
 * u příští zaplacené objednávky — jednou, ne za každou další.
 */
export const decideAutomaticLoyaltyCode = (input: AutoLoyaltyInput): AutoLoyaltyDecision => {
  if (!input.settings.auto_enabled) return skip("disabled")
  if (input.testMode) return skip("test-mode")
  if (!(input.email ?? "").trim()) return skip("no-email")
  if (!input.registered) return skip("guest")
  if (input.paidOrders < input.settings.after_orders) return skip("not-yet")
  if (!input.newsletterEligible) return skip("no-newsletter")
  if (input.alreadyIssued) return skip("already-issued")
  return { send: true, reason: null }
}

/** Stav kódu pro kartu zákazníka. */
export type LoyaltyCodeState = "active" | "used" | "expired"

export const loyaltyCodeState = (
  campaign: {
    ends_at?: string | Date | null
    budget?: { used?: unknown; limit?: unknown } | null
  },
  now: Date = new Date()
): LoyaltyCodeState => {
  const used = Number((campaign.budget?.used as any)?.value ?? campaign.budget?.used ?? 0)
  const limit = Number((campaign.budget?.limit as any)?.value ?? campaign.budget?.limit ?? 0)
  if (limit > 0 && used >= limit) return "used"
  if (campaign.ends_at && new Date(campaign.ends_at).getTime() < now.getTime()) return "expired"
  return "active"
}
