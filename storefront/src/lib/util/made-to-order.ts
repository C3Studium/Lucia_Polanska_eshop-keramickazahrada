/**
 * Made-to-order: the contract shared by the product page, checkout and express checkout.
 *
 * Types and pure helpers only, so client components can import them. The fetchers live in
 * `@lib/data/made-to-order`, which reaches for server-only cookies.
 */

export type ProductionVariantRule = {
  variant_id: string
  deposit_percentage_override?: number | null
  /** Přepis lhůty u provedení — store API `production-profile` ho vrací vedle zálohy. */
  production_time_min_days_override?: number | null
  production_time_max_days_override?: number | null
}

export type ProductionProfile = {
  enabled: boolean
  specification_required: boolean
  specification_prompt?: string | null
  production_time_min_days?: number | null
  production_time_max_days?: number | null
  default_deposit_percentage?: number | null
  allow_full_prepayment?: boolean | null
  variants?: ProductionVariantRule[] | null
}

export type ProductionPaymentModeKind = "deposit" | "full" | "custom"

/**
 * The slider's bounds, as charge-now totals.
 *
 * `minimum` is the owner's floor — the deposit she needs to buy materials — and is never zero
 * and never "pay later". `maximum` is everything the basket allows to be paid today, which a
 * piece that forbids full prepayment can hold below the cart total. The backend computes and
 * re-clamps all three; the storefront only draws them.
 */
export type ProductionPaymentBounds = {
  minimum: number
  maximum: number
  amount: number
}

export type ProductionPaymentMode = {
  has_made_to_order: boolean
  can_pay_full: boolean
  mode: ProductionPaymentModeKind
  deposit_amount: number
  full_amount: number
  balance_later: number
  currency_code?: string
  custom: ProductionPaymentBounds | null
}

/** The deposit that applies to a variant: its override beats the product default. */
export const depositPercentageFor = (
  profile: ProductionProfile | null | undefined,
  variantId?: string | null
) => {
  if (!profile) return null

  const override = profile.variants?.find(
    (rule) => rule.variant_id === variantId
  )?.deposit_percentage_override

  return override ?? profile.default_deposit_percentage ?? null
}

/** One photo the customer attached to a commission, as stored and as displayed. */
export type CommissionPhoto = {
  id?: string
  url: string
}

/** A photo on its way up. Lives here, not in the action file, so the picker can import it. */
export type CommissionUpload = {
  filename: string
  mime_type: string
  /** Base64, `data:` prefix included or not — the route copes with either. */
  data: string
}

/** An entry in the zakázka's diary, from either side of the conversation. */
export type CommissionNote = {
  id: string
  text?: string | null
  /** Fotky této zprávy. Jedno odeslání = jeden řádek s polem fotek. */
  images?: string[] | null
  /** Zpětná kompatibilita: staré řádky nesly jednu fotku tady. */
  image_url?: string | null
  author: "customer" | "atelier"
  created_at: string
}

/** Jedna zpráva ve vlákně — text + všechny fotky z jednoho odeslání. */
export type CommissionMessage = {
  key: string
  author: "customer" | "atelier"
  created_at: string
  text: string | null
  photos: string[]
}

/**
 * Každý řádek deníku je JEDNA zpráva: text + jeho fotky. Fotky bere z `images`
 * (nové pole — jedno odeslání = jeden řádek s polem fotek), a když chybí, ze
 * starého `image_url` (jedna fotka na řádek). Žádné slepování přes `batch_id` —
 * zpráva je atomická už v DB, takže se vlákno nemůže rozpadnout na N bublin.
 */
export const toCommissionMessages = (
  notes: CommissionNote[]
): CommissionMessage[] =>
  notes.map((note) => ({
    key: note.id,
    author: note.author,
    created_at: note.created_at,
    text: note.text?.trim() ? note.text : null,
    photos:
      note.images && note.images.length
        ? note.images
        : note.image_url
          ? [note.image_url]
          : [],
  }))

/** What the customer wrote and photographed, as it rides on the line item. */
export type CommissionBrief = {
  specification?: string
  note?: string
  photos?: string[]
}

/**
 * The line-item metadata shape the backend reads. Built here so no caller guesses it.
 *
 * `specification` is the answer to her question on the product page; `note` and `photos` are
 * the brief the customer writes at checkout. All three travel on the line item because Medusa
 * copies that metadata into the order — the cart is gone by the time anything reads it.
 */
export const madeToOrderMetadata = (
  specification: string,
  brief?: { note?: string; photos?: string[] }
) => ({
  made_to_order: {
    specification: specification.trim(),
    ...(brief?.note?.trim() ? { note: brief.note.trim() } : {}),
    ...(brief?.photos?.length ? { photos: brief.photos } : {}),
  },
})

/** Reads the brief back off a cart or order line, whatever shape it arrived in. */
export const readCommissionBrief = (item: {
  metadata?: Record<string, any> | null
}): CommissionBrief => {
  const raw = item?.metadata?.made_to_order
  if (!raw || typeof raw !== "object") return {}

  return {
    specification:
      typeof raw.specification === "string" ? raw.specification : undefined,
    note: typeof raw.note === "string" ? raw.note : undefined,
    photos: Array.isArray(raw.photos)
      ? raw.photos.filter((url: unknown): url is string => typeof url === "string")
      : undefined,
  }
}

/** "14–42 dní" / "do 42 dní" / "od 14 dní", whichever the profile can actually support. */
export const productionTimeLabel = (profile: ProductionProfile) => {
  const min = profile.production_time_min_days
  const max = profile.production_time_max_days

  if (min && max) return min === max ? `${max} dní` : `${min}–${max} dní`
  if (max) return `do ${max} dní`
  if (min) return `od ${min} dní`

  return null
}

/**
 * Nejdelší lhůta výroby pro provedení — přepis u varianty má přednost. Podle
 * auditu § 0 Z9 je to lhůta „od zahájení výroby", ne orientace.
 */
export const productionMaxDaysFor = (
  profile: ProductionProfile | null | undefined,
  variantId?: string | null
): number | null => {
  if (!profile) return null
  const override = profile.variants?.find(
    (rule) => rule.variant_id === variantId
  )?.production_time_max_days_override
  const max = override ?? profile.production_time_max_days
  return typeof max === "number" && max > 0 ? max : null
}

/* ---------------------------------------------------------------------------
 * Texty, které zákazník vidí u zakázky — jeden zdroj pro stránku produktu,
 * kartu v obchodě, košík, pokladnu a účet (audit § 0, pravidla Z4, Z5, Z9, Z10).
 * ------------------------------------------------------------------------ */

/**
 * Znění druhého zaškrtnutí v pokladně (Z10) — stejné jako v PDF Potvrzení
 * zakázky, bod 08. Sankce (nevratná záloha) musí být odsouhlasena výslovně,
 * ne jen schovaná v OP (§ 1753, § 1820 odst. 1 písm. j) OZ).
 */
export const MADE_TO_ORDER_ACK_TEXT =
  "Beru na vědomí, že výrobek vyrobený podle mého zadání nelze vrátit ve 14denní lhůtě a že záloha se po zahájení výroby nevrací."

/** Jedna věta o zrušení pro předsmluvní informace (Z4 + Z5). */
export const MADE_TO_ORDER_CANCEL_SENTENCE =
  "Zrušíte-li zakázku před zahájením výroby (poznáte to z e-mailu „Zakázka je ve výrobě“), vrátíme vám všechno; po zahájení se záloha nevrací, zbytek ano."

/**
 * Štítek pod cenou: „Na zakázku · záloha 25 % · výroba do 42 dnů · nelze
 * vrátit do 14 dnů". Co profil nedá, se vynechá — bez profilu (zakázka jen
 * kategorií) zůstane „Na zakázku · nelze vrátit do 14 dnů". Nic se nevymýšlí.
 */
export const madeToOrderBadgeText = ({
  depositPercentage,
  maxDays,
}: {
  depositPercentage?: number | null
  maxDays?: number | null
} = {}) =>
  [
    "Na zakázku",
    depositPercentage != null && depositPercentage > 0
      ? `záloha ${depositPercentage} %`
      : null,
    maxDays != null && maxDays > 0 ? `výroba do ${maxDays} dnů` : null,
    "nelze vrátit do 14 dnů",
  ]
    .filter(Boolean)
    .join(" · ")

/**
 * Smluvní podmínky zakázky pro řádek „Zakázka" v předsmluvních informacích
 * (Z10): záloha v % (jedno číslo, jen když se všechny zakázkové položky
 * shodnou — jinak se procento vynechá a zůstane částka) a nejdelší lhůta od
 * zahájení výroby (nejdelší z položek).
 */
export const commissionTermsSummary = (
  leadTimes: {
    deposit_percentage?: number | null
    production_time_max_days?: number | null
  }[]
): { depositPercentage: number | null; maxDays: number | null } => {
  const percentages = Array.from(
    new Set(
      leadTimes
        .map((lead) => lead.deposit_percentage)
        .filter((value): value is number => typeof value === "number" && value > 0)
    )
  )
  const days = leadTimes
    .map((lead) => lead.production_time_max_days)
    .filter((value): value is number => typeof value === "number" && value > 0)
  return {
    depositPercentage: percentages.length === 1 ? percentages[0] : null,
    maxDays: days.length ? Math.max(...days) : null,
  }
}

/**
 * Věta o záloze: SMLUVNÍ záloha je z profilu (backend ji vrací jako
 * `deposit_amount`), ale zákazník může zaplatit i víc (celek, vlastní částka
 * ze slideru). Když se liší, řekne se obojí — „záloha N % = X Kč; teď platíte
 * Y Kč" — aby bylo jasné, co z toho po zahájení výroby propadá (Z5) a co se
 * vrací.
 */
export const depositSentence = (
  {
    contractualDeposit,
    depositPercentage,
    now,
    later,
  }: {
    contractualDeposit: number
    depositPercentage: number | null
    now: number
    later: number
  },
  money: (amount: number) => string
): string => {
  const label = depositPercentage ? `Záloha ${depositPercentage} %` : "Záloha"
  const balance =
    later > 0.005 ? `Doplatek ${money(later)} po dokončení.` : "Bez doplatku."
  if (Math.abs(now - contractualDeposit) < 0.005) {
    return `${label}: ${money(contractualDeposit)} — platíte teď. ${balance}`
  }
  return `${label} = ${money(contractualDeposit)}; teď platíte ${money(now)}. ${balance}`
}

/* ---------------------------------------------------------------------------
 * Stav zakázky v účtu a zrušení (Z3–Z7) — tvar odpovědí backendu a texty.
 * ------------------------------------------------------------------------ */

export type CommissionCancellationPhase = "before_production" | "after_production"

/** `GET /store/made-to-order/:orderId/balance` — stav zakázky pro stránky objednávky. */
export type CommissionBalance = {
  is_commission: boolean
  stage?: string
  currency_code?: string
  deposit_paid?: number
  balance_paid?: number
  outstanding?: number
  /** Podepsaný odkaz na doplacení (funguje i bez přihlášení); null = není co platit. */
  pay_url?: string | null
  /** Smluvní záloha (Z2: nejvýš 50 % ceny výrobku) — částka a procento z výrobního profilu. */
  deposit_amount?: number
  deposit_percentage?: number
  /** Kdy odešel e-mail „Zakázka je ve výrobě" (Z3). null = výroba nezačala. */
  production_start_notified_at?: string | null
  cancellation_phase?: CommissionCancellationPhase | null
  cancelled_by?: "customer" | "seller" | null
  cancellation_refund_amount?: number | null
  /** PDF „Potvrzení zakázky" (Z11), když už vzniklo. */
  confirmation_pdf_url?: string | null
  confirmation_sent_at?: string | null
  production_time_max_days?: number | null
}

/** `GET /store/made-to-order/:orderId/cancellation` — co by zrušení TEĎ znamenalo. */
export type CommissionCancellation = {
  can_cancel: boolean
  /** Česká věta, proč zrušit nejde (už zrušeno, hotovo, odesláno…). */
  blocked_reason: string | null
  phase: CommissionCancellationPhase
  production_start_notified_at: string | null
  stage: string
  currency_code: string
  paid_total: number
  deposit_amount: number
  deposit_percentage: number
  /** Kolik se vrátí (před zahájením vše, po zahájení vše nad zálohu). */
  refund_amount: number
  /** Kolik si ateliér nechá (po zahájení = záloha, Z5). */
  deposit_kept: number
}

export type CommissionCancelResult = {
  ok: true
  phase: CommissionCancellationPhase
  refund_amount: number
}

/** „20. 10. 2026 14:05" — čas e-mailu o zahájení v českém čase (Z3), ne v čase serveru. */
export const formatCommissionDateTime = (iso: string): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(new Date(iso))

export type CommissionPhaseFacts = Pick<
  CommissionBalance,
  | "stage"
  | "production_start_notified_at"
  | "cancellation_phase"
  | "cancelled_by"
  | "cancellation_refund_amount"
>

/**
 * Stav zakázky slovy pro panel v účtu: před e-mailem Z3 „Čeká na zahájení
 * výroby", po něm „Ve výrobě od …", po zrušení „Zrušeno". Dokončená /
 * odeslaná zakázka má stav v hlavičce objednávky; panel tam říká jen, odkdy se
 * vyrábělo. Nic víc se nevymýšlí.
 */
export const commissionStatusLabel = (facts: CommissionPhaseFacts): string => {
  if (facts.stage === "cancelled" || facts.cancellation_phase) return "Zrušeno"
  if (facts.production_start_notified_at) {
    return `Ve výrobě od ${formatCommissionDateTime(facts.production_start_notified_at)}`
  }
  return "Čeká na zahájení výroby"
}

type Money = (amount: number) => string

/**
 * Věta ke zrušené zakázce: fáze (Z4/Z5/Z7) a částka, kterou backend vrací.
 * Když backend částku nedal, věta o částce není.
 */
export const cancelledCommissionText = (
  facts: CommissionPhaseFacts,
  money: Money
): string => {
  const phase =
    facts.cancellation_phase === "after_production"
      ? "po zahájení výroby"
      : facts.cancellation_phase === "before_production"
        ? "před zahájením výroby"
        : null
  const who = facts.cancelled_by === "seller" ? "z naší strany" : null
  const head = ["Zakázka byla zrušena", phase, who].filter(Boolean).join(" ")

  const refund = facts.cancellation_refund_amount
  const amount =
    typeof refund !== "number"
      ? null
      : refund > 0.005
        ? `Vrátíme vám ${money(refund)} do 14 dnů stejnou cestou, jakou jste platili.`
        : "Není co vracet."

  return [`${head}.`, amount].filter(Boolean).join(" ")
}

export type CommissionCancelCopy =
  | {
      /** Před e-mailem Z3: jeden klik, vrací se vše (Z4). */
      steps: "single"
      lead: string
      button: string
    }
  | {
      /** Po e-mailu Z3: klik → potvrzení s částkami (Z5). */
      steps: "double"
      lead: string
      button: string
      confirm: string
    }

/**
 * Co zákazník čte u tlačítka „Zrušit zakázku" — podle fáze z backendu, ne
 * podle toho, co si storefront myslí o stavu. Částky jsou backendu.
 */
export const commissionCancelCopy = (
  cancellation: Pick<
    CommissionCancellation,
    | "phase"
    | "production_start_notified_at"
    | "refund_amount"
    | "deposit_kept"
    | "deposit_amount"
  >,
  money: Money
): CommissionCancelCopy => {
  if (cancellation.phase === "before_production") {
    return {
      steps: "single",
      lead: `Vrátíme vám všechno (${money(cancellation.refund_amount)}) do 14 dnů stejnou cestou.`,
      button: "Zrušit zakázku",
    }
  }

  const since = cancellation.production_start_notified_at
    ? ` od ${formatCommissionDateTime(cancellation.production_start_notified_at)}`
    : ""
  const kept =
    cancellation.deposit_kept > 0.005
      ? cancellation.deposit_kept
      : cancellation.deposit_amount
  const refund =
    cancellation.refund_amount > 0.005
      ? `Vrátíme vám ${money(cancellation.refund_amount)}.`
      : "Není co vracet."

  return {
    steps: "double",
    lead: `Zakázka je ve výrobě${since}. Záloha ${money(kept)} se nevrací. ${refund}`,
    button: "Zrušit zakázku",
    confirm: "Ano, zrušit zakázku",
  }
}
