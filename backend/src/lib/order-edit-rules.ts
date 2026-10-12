/**
 * Pravidla zákaznické úpravy objednávky — ČISTÉ funkce, dokazované testem
 * (`__tests__/order-edit-rules.unit.spec.ts`). Kontrakt:
 * `docs/uprava-objednavky-plan.md` §3c (rozhodnuto 11. 10. 2026).
 *
 * Zákony:
 * 1. Úprava není zrušení — po akcích musí zbýt aspoň jeden kus (zamčené
 *    řádky se počítají, ty zůstávají vždy).
 * 2. Zamčené řádky se nemění: zakázka (záloha, zadání, výroba — nejde to
 *    spočítat automaticky), balíček (cena balíčku ≠ součet komponent),
 *    poškozený kus (každý je jen jeden).
 * 3. Do „připravena k odeslání" (mode `full`) jde přidat cokoli z obchodu,
 *    odebrat, měnit množství i vyměnit variantu. Po zabalení (`swap_only`)
 *    jen výměna varianty za stejnou cenu — tu kontroluje až náhled ceny.
 * 4. Peníze: karta + dráž = zaplatit PŘED potvrzením; karta + levněji =
 *    potvrdit a založit žádost v modulu reklamací (refundace + dobropis);
 *    odběr / dobírka = vyrovná se při předání.
 * 5. Limit: nejvýš 3 potvrzené úpravy na objednávku.
 */

export type EditAction =
  | { type: "swap"; item_id: string; variant_id: string }
  | { type: "remove"; item_id: string }
  | { type: "set_quantity"; item_id: string; quantity: number }
  | { type: "add"; variant_id: string; quantity: number }

export type EditMode = "full" | "swap_only" | "none"

export type LineLock = "made_to_order" | "bundle" | "clearance"

export type OrderLineInfo = {
  id: string
  quantity: number
  is_made_to_order: boolean
  /** Zámek řádku; `is_made_to_order` stačí i bez něj (starší volající). */
  lock?: LineLock | null
  /** Varianty téhož produktu (pro UI výměny); výměna smí i na jiný výrobek. */
  variant_ids?: string[] | null
  /** Aktuální varianta řádku — výměna sama za sebe nic nemění. */
  variant_id?: string | null
}

const lineVariantOf = (line: OrderLineInfo): string | null => line.variant_id ?? null

export type PaymentKind = "card" | "pickup" | "dobirka"

/** Kolik potvrzených úprav smí zákazník udělat sám (§3c.8). */
export const EDIT_LIMIT = 3

export const MAX_SET_QUANTITY = 99
export const MAX_ADD_QUANTITY = 20
export const MAX_ACTIONS = 30

/** Česká věta k zamčenému řádku — UI ji ukazuje šedě, server ji vrací v chybě. */
export const LOCK_REASON: Record<LineLock, string> = {
  made_to_order:
    "Zakázka — změny domluvíme v konverzaci k zakázce nebo po telefonu.",
  bundle: "Balíček se upravuje jen celý — napište nám, domluvíme se.",
  clearance: "Poškozený kus je jen jeden — vyměnit ani přidat ho nejde.",
}

type ProductLike = {
  metadata?: Record<string, unknown> | null
} | null | undefined

/**
 * Zámek řádku z jeho dat: značka zakázky na řádku nebo výrobní profil
 * produktu (`hasProductionProfile` — značka na řádku vzniká jen zálohovým
 * tokem), balíček (`product.metadata.is_bundle`), poškozený kus
 * (`product.metadata.clearance === true`, lib/clearance.ts).
 */
export const lineLockFor = (input: {
  lineMetadata?: Record<string, unknown> | null
  product?: ProductLike
  hasProductionProfile?: boolean
}): LineLock | null => {
  if (input.lineMetadata?.made_to_order || input.hasProductionProfile) {
    return "made_to_order"
  }
  const meta = (input.product?.metadata ?? {}) as Record<string, unknown>
  if (meta.is_bundle) {
    return "bundle"
  }
  if (meta.clearance === true) {
    return "clearance"
  }
  return null
}

const lockOf = (line: OrderLineInfo): LineLock | null =>
  line.lock ?? (line.is_made_to_order ? "made_to_order" : null)

export type EditVerdict = { ok: true } | { ok: false; reason: string }

export const validateEditActions = (
  lines: OrderLineInfo[],
  actions: EditAction[],
  options: { mode?: EditMode; confirmedEdits?: number; limit?: number } = {}
): EditVerdict => {
  const mode = options.mode ?? "full"
  const limit = options.limit ?? EDIT_LIMIT

  if (!actions.length) {
    return { ok: false, reason: "Žádná změna k uložení." }
  }
  if (actions.length > MAX_ACTIONS) {
    return { ok: false, reason: "Příliš mnoho změn najednou — rozdělte je prosím." }
  }
  if (mode === "none") {
    return { ok: false, reason: "Objednávku už upravit nejde — ozvěte se nám prosím." }
  }
  if ((options.confirmedEdits ?? 0) >= limit) {
    return {
      ok: false,
      reason: `Objednávku jste už upravili ${limit}× — další změny prosím domluvíme spolu.`,
    }
  }
  if (mode === "swap_only" && actions.some((action) => action.type !== "swap")) {
    return {
      ok: false,
      reason:
        "Objednávka je připravená k odeslání — vyměnit jde už jen za výrobek nebo provedení ve stejné ceně.",
    }
  }

  const byId = new Map(lines.map((line) => [line.id, line]))
  const touched = new Set<string>()

  for (const action of actions) {
    if (action.type === "add") {
      if (
        !Number.isInteger(action.quantity) ||
        action.quantity < 1 ||
        action.quantity > MAX_ADD_QUANTITY
      ) {
        return { ok: false, reason: `Přidat jde 1 až ${MAX_ADD_QUANTITY} kusů.` }
      }
      continue
    }

    const line = byId.get(action.item_id)
    if (!line) {
      return { ok: false, reason: "Položka v objednávce není." }
    }
    // Jedna změna na řádek — dvě protichůdné akce (odebrat + změnit počet)
    // by se v Meduse sčítaly nepředvídatelně.
    if (touched.has(line.id)) {
      return { ok: false, reason: "U jedné položky jde najednou jen jedna změna." }
    }
    touched.add(line.id)

    const lock = lockOf(line)
    if (lock) {
      return { ok: false, reason: LOCK_REASON[lock] }
    }

    if (action.type === "set_quantity") {
      if (
        !Number.isInteger(action.quantity) ||
        action.quantity < 1 ||
        action.quantity > MAX_SET_QUANTITY
      ) {
        return {
          ok: false,
          reason: `Počet kusů musí být 1 až ${MAX_SET_QUANTITY} — pro odebrání použijte Odebrat.`,
        }
      }
    }

    if (action.type === "swap" && action.variant_id === lineVariantOf(line)) {
      return { ok: false, reason: "Tohle je stejné provedení — není co měnit." }
    }
    // Výměna za JINÝ výrobek je povolená (§3d.10): cíl kontroluje jádro stejně
    // jako přidání (addTargetProblem + sklad), po zabalení jen stejná cena.
  }

  // Úprava ≠ zrušení: kolik kusů po akcích zbyde (zamčené řádky zůstávají).
  const removed = new Set(
    actions
      .filter((a): a is Extract<EditAction, { type: "remove" }> => a.type === "remove")
      .map((a) => a.item_id)
  )
  const keptLines = lines.filter((line) => !removed.has(line.id) && line.quantity > 0).length
  const added = actions.filter((a) => a.type === "add").length
  if (keptLines + added < 1) {
    return {
      ok: false,
      reason:
        "Objednávka nemůže zůstat prázdná — tohle je úprava, ne zrušení. Zrušit ji můžete přes Reklamace a zrušení.",
    }
  }
  return { ok: true }
}

/**
 * Smí se tenhle produkt přidat (nebo stát cílem výměny)? `null` = ano, jinak
 * česká věta proč ne. Stejná pravidla filtruje i nabídka mini obchodu.
 */
export const addTargetProblem = (input: {
  product?: ProductLike
  hasProductionProfile?: boolean
  payment: PaymentKind
}): string | null => {
  const meta = (input.product?.metadata ?? {}) as Record<string, unknown>
  if (input.hasProductionProfile) {
    return "Zakázková výroba se do objednávky nepřidává — vytvořte prosím novou objednávku, ať se domluvíme na zadání."
  }
  if (meta.is_bundle) {
    return "Balíček se do úpravy nepřidává — objednejte ho prosím zvlášť."
  }
  if (meta.clearance === true) {
    return "Poškozený kus se do úpravy nepřidává — objednejte ho prosím zvlášť."
  }
  // Dobírka výchozí — blokuje jen výslovně vypnutá (Matěj 12. 10. 2026).
  if (input.payment === "dobirka" && meta.cod_allowed === false) {
    return "Tenhle výrobek nejde poslat na dobírku — objednejte ho prosím zvlášť."
  }
  return null
}

export type Settlement =
  | { kind: "none" }
  | { kind: "collect"; amount: number }
  | { kind: "refund_due"; amount: number }

/** Co se stane s penězi při daném rozdílu a způsobu platby. */
export const decideSettlement = (
  difference: number,
  payment: PaymentKind
): Settlement => {
  const rounded = Math.round(difference * 100) / 100
  if (payment !== "card" || Math.abs(rounded) <= 0.005) {
    // Odběr i dobírka se vyrovnají při předání — nic se neposílá.
    return { kind: "none" }
  }
  return rounded > 0
    ? { kind: "collect", amount: rounded }
    : { kind: "refund_due", amount: -rounded }
}

const czk = (value: number): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value)

/** Jedna věta pro souhrn: co se po uložení stane s penězi. */
export const moneySentence = (input: {
  difference: number
  payment: PaymentKind
  totalAfter: number
}): string => {
  const settlement = decideSettlement(input.difference, input.payment)
  if (input.payment === "dobirka") {
    return Math.abs(input.difference) <= 0.005
      ? "Cena se nemění — při převzetí zaplatíte stejně jako dosud."
      : `Při převzetí zaplatíte ${czk(input.totalAfter)}.`
  }
  if (input.payment === "pickup") {
    return Math.abs(input.difference) <= 0.005
      ? "Cena se nemění — v ateliéru zaplatíte stejně jako dosud."
      : `Při vyzvednutí v ateliéru zaplatíte ${czk(input.totalAfter)}.`
  }
  if (settlement.kind === "collect") {
    return `Doplatíte ${czk(settlement.amount)} kartou — úprava platí, až bude rozdíl zaplacený.`
  }
  if (settlement.kind === "refund_due") {
    return `Rozdíl ${czk(settlement.amount)} vám vrátíme na kartu a pošleme k němu opravný doklad.`
  }
  return "Cena se nemění."
}

/* ------------------------------------------------------------------------ */
/* Poštovné                                                                  */
/* ------------------------------------------------------------------------ */

export type ShippingPriceRule = {
  attribute: string
  operator?: string | null
  value: unknown
}

export type ShippingPrice = {
  amount: unknown
  currency_code?: string | null
  price_rules?: ShippingPriceRule[] | null
}

const ruleHolds = (
  rule: ShippingPriceRule,
  context: Record<string, string | number | null | undefined>
): boolean => {
  const actual = context[rule.attribute]
  if (actual === undefined || actual === null) {
    return false
  }
  const operator = String(rule.operator ?? "eq").toLowerCase()
  if (operator === "eq") {
    return String(actual) === String(rule.value)
  }
  const left = Number(actual)
  const right = Number(rule.value)
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false
  }
  switch (operator) {
    case "gt":
      return left > right
    case "gte":
      return left >= right
    case "lt":
      return left < right
    case "lte":
      return left <= right
    default:
      return false
  }
}

/**
 * Cena dopravy pro daný součet zboží — STEJNÉ cenové pravidlo jako pokladna
 * (ceny dopravy s pravidly `item_total` / `region_id` v Meduse). Z cen v měně
 * se berou ty, jejichž všechna pravidla platí; vyhrává nejkonkrétnější (nejvíc
 * pravidel), při shodě nejlevnější. `null` = nic neplatí (volající nechá
 * poštovné, jak je).
 *
 * Změřeno 11. 10. 2026: žádná doprava pravidlo `item_total` nemá — poštovné
 * se dnes přepočtem nezmění; začne, až Lucie dopravu zdarma nastaví.
 */
export const resolveShippingAmount = (
  prices: ShippingPrice[],
  context: { currency_code: string; region_id?: string | null; item_total: number }
): number | null => {
  const currency = context.currency_code.toLowerCase()
  const ctx = { region_id: context.region_id ?? null, item_total: context.item_total }
  const matching = prices
    .filter((price) => String(price.currency_code ?? "").toLowerCase() === currency)
    .filter((price) => (price.price_rules ?? []).every((rule) => ruleHolds(rule, ctx)))
    .map((price) => ({
      amount: Number(price.amount),
      specificity: (price.price_rules ?? []).length,
    }))
    .filter((price) => Number.isFinite(price.amount))
  if (!matching.length) {
    return null
  }
  matching.sort((a, b) => b.specificity - a.specificity || a.amount - b.amount)
  return Math.round(matching[0].amount * 100) / 100
}

export const shippingNote = (before: number, after: number): string | null =>
  Math.abs(before - after) <= 0.005
    ? null
    : `Poštovné ${czk(before)} → ${czk(after)}.`
