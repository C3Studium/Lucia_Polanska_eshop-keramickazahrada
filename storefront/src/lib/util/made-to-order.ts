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

/**
 * Jeden zakázkový řádek košíku v režimu platby (Z-A „zakázka = položka").
 * Backend ho zatím nemusí posílat — kde chybí, pokladna ukáže jen % a lhůtu
 * z profilu (`listProductionLeadTimes`) a částky nevymýšlí.
 */
export type ProductionPaymentLine = {
  line_id: string
  title?: string | null
  /** Smluvní procento té položky (1–50, Z2). */
  deposit_percentage?: number | null
  /** Smluvní záloha té položky v penězích. */
  deposit_amount?: number | null
  /** Cena řádku po slevě — základ doplatku. */
  line_total?: number | null
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
  /**
   * Totéž, ale JEN ZA ZAKÁZKU — panel „Kolik chcete zaplatit hned?" se ptá
   * na ni, ne na celý košík. `always_now` je zboží mimo zakázku (a poštovné,
   * když je na řadě), které se platí vždycky; pokladna si tím dopočítá
   * celkovou úhradu. Starší backend ho neposílá → panel spadne na částky
   * za celý košík jako dřív.
   */
  production_only?: (ProductionPaymentBounds & { always_now: number }) | null
  /** Rozpis po zakázkových řádcích — volitelný, viz `ProductionPaymentLine`. */
  production_lines?: ProductionPaymentLine[] | null
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
  /** Kdy zákazník zaškrtl poučení Z10 k TÉHLE položce (ISO). Zapisuje pokladna. */
  ack_at?: string
  /** Zadání po kusech (řádek s množstvím > 1); chybí u jediného kusu. */
  pieces?: CommissionPiece[]
}

/** Zadání JEDNOHO kusu zakázkového řádku — „Domovní znamení · 2 ks" = dva kusy. */
export type CommissionPiece = {
  specification: string
  photos: string[]
}

/**
 * Kusy řádku, doplněné na jeho množství. Zrcadlo `lib/commission-brief.ts`
 * na backendu: bez uloženého pole patří staré zadání PRVNÍMU kusu a zbylé
 * začínají prázdné — „vyplněno" by jinak lhalo a brána by pustila kus bez
 * zadání.
 */
export const commissionPiecesOf = (item: {
  quantity?: number | null
  metadata?: Record<string, any> | null
}): CommissionPiece[] => {
  const brief = readCommissionBrief(item)
  const count = Math.max(1, Math.floor(Number(item?.quantity ?? 1)) || 1)
  const stored = brief.pieces

  return Array.from({ length: count }, (_, index) => {
    const piece = stored?.[index]
    if (piece) {
      return {
        specification: piece.specification ?? "",
        photos: piece.photos ?? [],
      }
    }
    if (index === 0 && !stored) {
      return {
        specification: brief.specification || brief.note || "",
        photos: brief.photos ?? [],
      }
    }
    return { specification: "", photos: [] }
  })
}

/** Má kus zadání? Text NEBO fotka — táž podmínka jako brána u obou pokladen. */
export const commissionPieceFilled = (piece: CommissionPiece): boolean =>
  Boolean(piece.specification?.trim() || piece.photos.length)

/**
 * The line-item metadata shape the backend reads. Built here so no caller guesses it.
 *
 * `specification` is the answer to her question on the product page; `note` and `photos` are
 * the brief the customer writes at checkout. All three travel on the line item because Medusa
 * copies that metadata into the order — the cart is gone by the time anything reads it.
 *
 * `ack_at` (poučení Z10 per položka) se musí PŘENÉST, když brief ukládá
 * znovu — `metadata.made_to_order` je jeden objekt a Medusa ho nahradí celý;
 * samoukládání briefu po kliknutí na tlačítko platby by jinak čas zaškrtnutí
 * smazalo.
 */
export const madeToOrderMetadata = (
  specification: string,
  brief?: { note?: string; photos?: string[]; ack_at?: string | null }
) => ({
  made_to_order: {
    specification: specification.trim(),
    ...(brief?.note?.trim() ? { note: brief.note.trim() } : {}),
    ...(brief?.photos?.length ? { photos: brief.photos } : {}),
    ...(brief?.ack_at ? { ack_at: brief.ack_at } : {}),
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
    ack_at: typeof raw.ack_at === "string" ? raw.ack_at : undefined,
    pieces: Array.isArray(raw.pieces)
      ? raw.pieces.map((piece: any) => ({
          specification:
            typeof piece?.specification === "string" ? piece.specification : "",
          photos: Array.isArray(piece?.photos)
            ? piece.photos.filter(
                (url: unknown): url is string => typeof url === "string"
              )
            : [],
        }))
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

/**
 * Totéž znění s názvem položky (Z-A „zakázka = položka"): u objednávky s víc
 * zakázkami má každá své zaškrtnutí a zákazník musí vidět, které se týká
 * čeho — „výrobek „Domovní číslo“ vyrobený podle mého zadání…". Bez názvu
 * (jedna zakázka) zůstává přesně `MADE_TO_ORDER_ACK_TEXT`, ať se uložené
 * znění shoduje s PDF Potvrzení zakázky.
 */
export const madeToOrderAckText = (title?: string | null): string => {
  const name = title?.trim()
  if (!name) return MADE_TO_ORDER_ACK_TEXT
  return MADE_TO_ORDER_ACK_TEXT.replace(
    "výrobek vyrobený",
    `výrobek „${name}“ vyrobený`
  )
}

/** Zakázková položka pokladny, ke které patří vlastní zaškrtnutí Z10. */
export type MadeToOrderAckItem = {
  /** Id řádku košíku; `cart`, když zakázku hlásí jen režim platby bez řádku. */
  id: string
  title: string | null
}

/**
 * Jedno zaškrtnutí na každý zakázkový řádek. Když profil výroby hlásí
 * zakázku, ale žádný řádek ji nenese (nemělo by nastat — pojistka), zůstane
 * jedno zaškrtnutí za celý košík jako dřív. Jméno se do textu dává jen při
 * víc položkách — s jednou je znění přesně to z PDF.
 */
export const madeToOrderAckItems = (
  lines: { id: string; title?: string | null }[],
  hasMadeToOrder: boolean
): MadeToOrderAckItem[] => {
  if (lines.length === 0) {
    return hasMadeToOrder ? [{ id: "cart", title: null }] : []
  }
  if (lines.length === 1) return [{ id: lines[0].id, title: null }]
  return lines.map((line) => ({
    id: line.id,
    title: line.title?.trim() || "výrobek na zakázku",
  }))
}

/** Všechna zaškrtnutí Z10 odsouhlasená? (`acks` = id řádku → čas ISO.) */
export const allMadeToOrderAcked = (
  items: MadeToOrderAckItem[],
  acks: Record<string, string | undefined>
): boolean => items.every((item) => Boolean(acks[item.id]))

/** Čas posledního zaškrtnutí Z10 — ten se uloží do `made_to_order_ack_at`. */
export const latestAckAt = (
  acks: Record<string, string | undefined>
): string | null => {
  const times = Object.values(acks).filter((value): value is string => Boolean(value))
  if (!times.length) return null
  return times.reduce((latest, current) => (current > latest ? current : latest))
}

/** Jedna věta o zrušení pro předsmluvní informace (Z4 + Z5). */
export const MADE_TO_ORDER_CANCEL_SENTENCE =
  "Zrušíte-li zakázku před zahájením výroby (poznáte to z e-mailu „Zakázka je ve výrobě“), vrátíme vám všechno; po zahájení se záloha nevrací, zbytek ano."

/**
 * Zkratka poučení § 1837 písm. d) OZ do štítku.
 *
 * Dřív tu stálo „nelze vrátit do 14 dnů", což se čte dvojsmyslně — jako by
 * kus nešlo vrátit prvních 14 dnů a potom už ano. Zákon říká opak: u věci
 * vyrobené na míru 14denní lhůta na vrácení bez udání důvodu NEPLATÍ vůbec.
 * Reklamace vady tím dotčená není, proto „na vrácení", ne „na reklamaci".
 */
export const MADE_TO_ORDER_NO_RETURN_SHORT = "bez 14denní lhůty na vrácení"

/**
 * Štítek pod cenou: „Na zakázku · záloha 25 % · výroba do 42 dnů · bez
 * 14denní lhůty na vrácení". Co profil nedá, se vynechá — bez profilu
 * (zakázka jen kategorií) zůstane „Na zakázku · bez 14denní lhůty na
 * vrácení". Nic se nevymýšlí.
 *
 * `priceOnRequest`: u kusu s cenou po domluvě se procento NEUVÁDÍ — záloha
 * se počítá z ceny, kterou teprve domluvíte, takže „záloha 25 %" by bylo
 * procento z nuly.
 */
export const madeToOrderBadgeText = ({
  depositPercentage,
  maxDays,
  priceOnRequest = false,
}: {
  depositPercentage?: number | null
  maxDays?: number | null
  priceOnRequest?: boolean
} = {}) =>
  [
    "Na zakázku",
    priceOnRequest
      ? "záloha po domluvě ceny"
      : depositPercentage != null && depositPercentage > 0
        ? `záloha ${depositPercentage} %`
        : null,
    maxDays != null && maxDays > 0 ? `výroba do ${maxDays} dnů` : null,
    MADE_TO_ORDER_NO_RETURN_SHORT,
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

/**
 * Řádek „Zakázka" per položka (Z-A): „Domovní číslo: záloha 25 % (500 Kč) ·
 * výroba do 42 dnů od zahájení". Procento a lhůta jsou z profilu
 * (`leadTimes`), částka z rozpisu režimu platby (`production_lines`) — a co
 * backend nedal, se vynechá; bez ničeho zůstane jen „Domovní číslo: na
 * zakázku".
 */
export const commissionItemTermsLine = (
  {
    title,
    depositPercentage,
    depositAmount,
    maxDays,
  }: {
    title: string
    depositPercentage?: number | null
    depositAmount?: number | null
    maxDays?: number | null
  },
  money: (amount: number) => string
): string => {
  const amount =
    typeof depositAmount === "number" && depositAmount > 0
      ? ` (${money(depositAmount)})`
      : ""
  const deposit =
    depositPercentage != null && depositPercentage > 0
      ? `záloha ${depositPercentage} %${amount}`
      : amount
        ? `záloha${amount}`
        : null
  const days = maxDays != null && maxDays > 0 ? `výroba do ${maxDays} dnů od zahájení` : null
  const terms = [deposit, days].filter(Boolean).join(" · ")
  return `${title}: ${terms || "na zakázku"}`
}

/**
 * Součet za víc zakázek: „Celkem záloha 1 200 Kč teď, doplatky 3 600 Kč po
 * dokončení." Částky jsou backendu (`chargeSplit` nad režimem platby) —
 * sčítá se jen slovy.
 */
export const commissionTotalsSentence = (
  { now, later }: { now: number; later: number },
  money: (amount: number) => string
): string =>
  later > 0.005
    ? `Celkem záloha ${money(now)} teď, doplatky ${money(later)} po dokončení.`
    : `Celkem ${money(now)} teď, bez doplatků.`

/* ---------------------------------------------------------------------------
 * Stav zakázky v účtu a zrušení (Z3–Z7) — tvar odpovědí backendu a texty.
 * ------------------------------------------------------------------------ */

export type CommissionCancellationPhase = "before_production" | "after_production"

/**
 * Co by zrušení znamenalo TEĎ, přibalené k zakázce v `balance` (Z-A) — tvar
 * `cancellation_preview` z kontraktu. Panel z něj složí `CommissionCancellation`
 * a nemusí se ptát `/cancellation` za každou zakázku zvlášť.
 */
export type CommissionCancellationPreview = {
  phase: CommissionCancellationPhase
  paid_total: number
  refund_amount: number
  deposit_kept: number
}

/**
 * JEDNA zakázka = jeden zakázkový řádek objednávky (Z-A „zakázka = položka").
 * `GET …/balance` vrací `commissions[]`; dokud backend pole neposílá, vzniká
 * jedna zakázka z polí na nejvyšší úrovni (`commissionsOf`). Proto je skoro
 * všechno volitelné — co backend nedal, panel neukáže.
 */
export type Commission = {
  /** Id `production_order`; chybí jen u zpětně složené zakázky ze starého tvaru. */
  production_order_id?: string | null
  line_item_id?: string | null
  title?: string | null
  variant_title?: string | null
  thumbnail?: string | null
  quantity?: number | null
  stage?: string
  currency_code?: string
  item_total?: number | null
  /** Smluvní záloha (Z2: nejvýš 50 % ceny výrobku) — procento a částka z výrobního profilu. */
  deposit_percentage?: number | null
  deposit_amount?: number | null
  deposit_paid?: number
  balance_paid?: number
  outstanding?: number
  /** Podepsaný odkaz na doplacení TÉHLE zakázky; null = není co platit. */
  pay_url?: string | null
  /** Kdy odešel e-mail „Zakázka je ve výrobě" (Z3). null = výroba nezačala. */
  production_start_notified_at?: string | null
  estimated_completion_at?: string | null
  production_time_max_days?: number | null
  cancelled_by?: "customer" | "seller" | null
  cancellation_phase?: CommissionCancellationPhase | null
  cancellation_refund_amount?: number | null
  cancelled_at?: string | null
  /** PDF „Potvrzení zakázky" (Z11), když už vzniklo. */
  confirmation_pdf_url?: string | null
  confirmation_sent_at?: string | null
  can_cancel?: boolean
  blocked_reason?: string | null
  cancellation_preview?: CommissionCancellationPreview | null
}

/** Součty přes všechny zakázky objednávky (`totals` z kontraktu). */
export type CommissionTotals = {
  deposit_paid: number
  balance_paid: number
  outstanding: number
}

/**
 * `GET /store/made-to-order/:orderId/balance` — stav zakázek pro stránky
 * objednávky. Pole na nejvyšší úrovni = první zakázka / součty (zpětná
 * kompatibilita); `commissions[]` + `totals` jsou tvar Z-A.
 */
export type CommissionBalance = Commission & {
  is_commission: boolean
  commissions?: Commission[] | null
  totals?: CommissionTotals | null
}

/**
 * Seznam zakázek objednávky, ať backend vrací nový tvar (`commissions[]`)
 * nebo starý (jedna zakázka v polích na nejvyšší úrovni). JEDINÉ místo, kde
 * se ty dva tvary rozlišují — stránky dál vidí vždy pole.
 */
export const commissionsOf = (
  balance: CommissionBalance | null | undefined
): Commission[] => {
  if (!balance?.is_commission) return []
  if (Array.isArray(balance.commissions) && balance.commissions.length) {
    return balance.commissions
  }
  // Starý tvar: `is_commission`, `commissions`, `totals` nejsou zakázka.
  const { is_commission: _flag, commissions: _list, totals: _totals, ...single } = balance
  return [single]
}

/**
 * Součty za objednávku: `totals` z backendu, jinak sečtené ze zakázek. U
 * starého tvaru vyjdou pole na nejvyšší úrovni (jedna zakázka = součet).
 */
export const commissionTotalsOf = (
  balance: CommissionBalance | null | undefined
): CommissionTotals => {
  if (balance?.totals) {
    return {
      deposit_paid: balance.totals.deposit_paid ?? 0,
      balance_paid: balance.totals.balance_paid ?? 0,
      outstanding: balance.totals.outstanding ?? 0,
    }
  }
  return commissionsOf(balance).reduce<CommissionTotals>(
    (sum, commission) => ({
      deposit_paid: sum.deposit_paid + (commission.deposit_paid ?? 0),
      balance_paid: sum.balance_paid + (commission.balance_paid ?? 0),
      outstanding: sum.outstanding + (commission.outstanding ?? 0),
    }),
    { deposit_paid: 0, balance_paid: 0, outstanding: 0 }
  )
}

/**
 * `CommissionCancellation` složená z náhledu přibaleného k zakázce — panel
 * pak nemusí volat `/cancellation`. `undefined` = náhled chybí (starý tvar)
 * → panel si ho dotáhne sám.
 */
export const cancellationOf = (
  commission: Commission
): CommissionCancellation | undefined => {
  const preview = commission.cancellation_preview
  if (!preview || typeof commission.can_cancel !== "boolean") return undefined
  return {
    can_cancel: commission.can_cancel,
    blocked_reason: commission.blocked_reason ?? null,
    phase: preview.phase,
    production_start_notified_at: commission.production_start_notified_at ?? null,
    stage: commission.stage ?? "",
    currency_code: commission.currency_code ?? "czk",
    paid_total: preview.paid_total,
    deposit_amount: commission.deposit_amount ?? 0,
    deposit_percentage: commission.deposit_percentage ?? 0,
    refund_amount: preview.refund_amount,
    deposit_kept: preview.deposit_kept,
  }
}

/** „Domovní číslo · Modrá" — název zakázky s provedením, pro nadpis panelu a seznam. */
export const commissionTitle = (commission: Pick<Commission, "title" | "variant_title">) =>
  [commission.title?.trim(), commission.variant_title?.trim()]
    .filter(Boolean)
    .join(" · ") || null

/** „20. 10. 2026" — datum bez času, pro stručný řádek v seznamu objednávek. */
export const formatCommissionDate = (iso: string): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Prague",
  }).format(new Date(iso))

/**
 * Stručný řádek do seznamu objednávek: „Zakázka: Domovní číslo — ve výrobě od
 * 20. 10. 2026". Bez názvu jen „Zakázka — …".
 */
export const commissionListLine = (
  commission: Pick<
    Commission,
    | "title"
    | "variant_title"
    | "stage"
    | "production_start_notified_at"
    | "cancellation_phase"
  >
): string => {
  const name = commissionTitle(commission)
  const status =
    commission.stage === "cancelled" || commission.cancellation_phase
      ? "zrušeno"
      : commission.stage === "completed"
        ? "hotovo"
        : commission.production_start_notified_at
          ? `ve výrobě od ${formatCommissionDate(commission.production_start_notified_at)}`
          : "čeká na zahájení výroby"
  return name ? `Zakázka: ${name} — ${status}` : `Zakázka — ${status}`
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
