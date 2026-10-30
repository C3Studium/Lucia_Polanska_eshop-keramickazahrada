/**
 * Dárkový poukaz s vlastní částkou (právní audit § 5, § 1820 a § 1826a OZ).
 *
 * ## Proč
 *
 * Poukaz „na nákup keramiky, 1 Kč" s pokynem „objednejte a libovolnou částku
 * převeďte na účet" znamenal, že cena v košíku a v objednávce neodpovídala
 * tomu, co zákazník platil. Teď si zákazník částku zvolí na stránce produktu
 * a TA se stane cenou řádku — propíše se do košíku, pokladny, objednávky
 * i platby.
 *
 * ## Datový kontrakt (product.metadata)
 *
 * - `voucher_custom_amount: true` — produkt je poukaz s vlastní částkou.
 * - `voucher_min` / `voucher_max` / `voucher_step` — celá čísla v měně poukazu.
 *   Chybí-li, platí `VOUCHER_DEFAULTS` (100 / 10 000 / 100) — výchozí hodnoty
 *   jsou provizorní, potvrdí je majitelka.
 * - `voucher_currency` — měna poukazu (výchozí `czk`). Košík v jiné měně poukaz
 *   s vlastní částkou koupit nemůže: meze jsou zadané v korunách a přepočítávat
 *   je kurzem by dávalo „poukaz na 4,13 €".
 *
 * Řádek košíku nese zvolenou částku v `metadata.voucher_amount`; cenu řádku
 * z ní nastaví krok `get-custom-price` (vlastní cena, Medusa ji pak při
 * přepočtech košíku nemění).
 *
 * Bez importů z frameworku — testuje se jako čistá funkce a stejná pravidla
 * kopíruje formulář na stránce produktu (`storefront/.../voucher-amount`).
 */

export const VOUCHER_FLAG = "voucher_custom_amount"
export const VOUCHER_AMOUNT_KEY = "voucher_amount"

export const VOUCHER_DEFAULTS = {
  min: 100,
  max: 10000,
  step: 100,
  currency: "czk",
} as const

export type VoucherConfig = {
  min: number
  max: number
  step: number
  currency: string
}

export type VoucherValidation =
  | { ok: true; amount: number }
  | { ok: false; message: string }

const truthy = (value: unknown) => value === true || value === "true"

/** Je produkt poukaz s vlastní částkou? */
export const isCustomAmountVoucher = (
  productMetadata: Record<string, unknown> | null | undefined
): boolean => truthy(productMetadata?.[VOUCHER_FLAG])

const positiveInt = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim())
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

/**
 * Meze z metadat produktu. Nesmyslné hodnoty (záporné, necelé, max < min)
 * spadnou na výchozí — špatně vyplněné metadata nesmí otevřít poukaz za 1 Kč.
 */
export const voucherConfig = (
  productMetadata: Record<string, unknown> | null | undefined
): VoucherConfig => {
  const min = positiveInt(productMetadata?.voucher_min) ?? VOUCHER_DEFAULTS.min
  const maxRaw = positiveInt(productMetadata?.voucher_max) ?? VOUCHER_DEFAULTS.max
  const max = maxRaw >= min ? maxRaw : Math.max(min, VOUCHER_DEFAULTS.max)
  const step = positiveInt(productMetadata?.voucher_step) ?? VOUCHER_DEFAULTS.step
  const currencyRaw = productMetadata?.voucher_currency
  const currency =
    typeof currencyRaw === "string" && /^[a-z]{3}$/i.test(currencyRaw.trim())
      ? currencyRaw.trim().toLowerCase()
      : VOUCHER_DEFAULTS.currency
  return { min, max, step, currency }
}

const unitOf = (currency: string) =>
  currency === "czk" ? "Kč" : currency === "eur" ? "€" : currency.toUpperCase()

const formatInt = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ")

/**
 * Ověří částku zadanou zákazníkem. `currencyCode` = měna košíku; když se liší
 * od měny poukazu, poukaz s vlastní částkou koupit nejde.
 */
export const validateVoucherAmount = (
  raw: unknown,
  config: VoucherConfig,
  currencyCode?: string | null
): VoucherValidation => {
  const unit = unitOf(config.currency)

  if (currencyCode && currencyCode.toLowerCase() !== config.currency) {
    return {
      ok: false,
      message: `Dárkový poukaz s vlastní částkou lze zatím koupit jen v měně ${unit}.`,
    }
  }

  const text = typeof raw === "number" ? String(raw) : String(raw ?? "").trim().replace(/\s+/g, "")
  if (!text) {
    return { ok: false, message: "Zadejte prosím částku poukazu." }
  }
  const amount = Number(text.replace(",", "."))
  if (!Number.isFinite(amount)) {
    return { ok: false, message: "Zadejte prosím částku poukazu číslem." }
  }
  if (!Number.isInteger(amount)) {
    const whole =
      config.currency === "czk" ? "korunách" : config.currency === "eur" ? "eurech" : "jednotkách"
    return { ok: false, message: `Částku poukazu zadejte v celých ${whole}.` }
  }
  if (amount < config.min || amount > config.max) {
    return {
      ok: false,
      message: `Částka poukazu musí být od ${formatInt(config.min)} do ${formatInt(config.max)} ${unit}.`,
    }
  }
  if ((amount - config.min) % config.step !== 0) {
    return {
      ok: false,
      message: `Částku poukazu zadejte po ${formatInt(config.step)} ${unit} (např. ${formatInt(config.min)}, ${formatInt(config.min + config.step)} …).`,
    }
  }
  return { ok: true, amount }
}

/**
 * Pojistka pro řádek přidaný MIMO vlastní cestu (`/store/carts/:id/line-items-custom`):
 * standardní `POST /store/carts/:id/line-items` cenu nebere, takže by poukaz
 * zůstal za katalogovou cenu (1 Kč) s jinou částkou v metadatech. Vrací
 * českou hlášku problému, nebo `null`, když je řádek v pořádku.
 *
 * Zapojení: `addToCartWorkflow.hooks.validate` — ten hook už konzumuje
 * `workflows/hooks/validate-personalized-product.ts` a Medusa dovolí jen
 * jeden handler, takže se volá odtamtud.
 */
export const voucherLineProblem = (input: {
  productMetadata: Record<string, unknown> | null | undefined
  itemMetadata: Record<string, unknown> | null | undefined
  unitPrice: unknown
  currencyCode?: string | null
}): string | null => {
  if (!isCustomAmountVoucher(input.productMetadata)) return null
  /*
   * Poukaz se od 30. 10. 2026 přidává do košíku NENASTAVENÝ — hodnotu i podobu
   * zvolí zákazník až v košíku (`line-items/:line_id/gift-voucher`). Takový
   * řádek stojí 0 a tohle je jediné místo, kde smí projít bez částky; k
   * pokladně ho pustí až `giftVoucherSetupProblem`.
   */
  if (voucherAmountPending(input.itemMetadata)) {
    const price = Number(input.unitPrice ?? 0)
    return Number.isFinite(price) && price === 0
      ? null
      : "Cena poukazu nesouhlasí se zvolenou částkou. Přidejte ho prosím do košíku znovu."
  }
  const result = validateVoucherAmount(
    input.itemMetadata?.[VOUCHER_AMOUNT_KEY],
    voucherConfig(input.productMetadata),
    input.currencyCode
  )
  // `in`, ne `!result.ok`: backend nemá `strict`, takže booleovský
  // diskriminant union nezúží.
  if ("message" in result) return result.message
  if (input.unitPrice === undefined || input.unitPrice === null) {
    return "Dárkový poukaz s vlastní částkou přidejte prosím ze stránky poukazu — částku zadáte tam."
  }
  if (Number(input.unitPrice) !== result.amount) {
    return "Cena poukazu nesouhlasí se zvolenou částkou. Přidejte ho prosím do košíku znovu."
  }
  return null
}

/* ------------------------------------------------------------------------- *
 * Nastavení poukazu v KOŠÍKU (30. 10. 2026)
 *
 * Dřív se hodnota, podoba i obdarovaný vyplňovali na stránce produktu. Pod
 * cenou tak stál formulář o pěti polích, který musel zákazník projít dřív, než
 * vůbec věděl, že poukaz chce — a dva poukazy pro dva lidi znamenaly projít ho
 * dvakrát. Teď se poukaz prostě přidá do košíku a nastaví se až tam, vedle
 * souhrnu: řádek do té chvíle stojí 0 a k pokladně se nedá projít
 * (`giftVoucherSetupProblem` hlídá `completeCartWorkflow`).
 *
 * Tohle je společný zdroj pravdy pro obě strany: cestu, která nastavení
 * ukládá (`/store/carts/:id/line-items/:line_id/gift-voucher`), i bránu před
 * dokončením košíku. Formulář ve storefrontu pravidla kopíruje jen kvůli
 * okamžité odezvě.
 * ------------------------------------------------------------------------- */

/** Klíče metadat položky košíku z nastavení poukazu (storefront píše stejné). */
export const VOUCHER_LINE_KEYS = {
  kind: "gift_voucher_kind",
  recipientName: "gift_voucher_recipient_name",
  recipientEmail: "gift_voucher_recipient_email",
  dedication: "gift_voucher_dedication",
} as const

export type VoucherKind = "electronic" | "physical"

export const VOUCHER_DEDICATION_MAX = 500
export const VOUCHER_RECIPIENT_NAME_MAX = 120
export const VOUCHER_EMAIL_MAX = 320

/** Je produkt dárkový poukaz (pevná hodnota i vlastní částka)? */
export const isGiftVoucherProduct = (
  metadata: Record<string, unknown> | null | undefined
): boolean =>
  metadata?.gift_voucher === true ||
  metadata?.gift_voucher === "true" ||
  isCustomAmountVoucher(metadata)

/** Částka ještě nezvolená — poukaz leží v košíku nenastavený. */
export const voucherAmountPending = (
  itemMetadata: Record<string, unknown> | null | undefined
): boolean => {
  const raw = itemMetadata?.[VOUCHER_AMOUNT_KEY]
  return raw === undefined || raw === null || String(raw).trim() === ""
}

/** Zvolená podoba poukazu, nebo `null`, dokud ji zákazník nevybral. */
export const voucherLineKind = (
  itemMetadata: Record<string, unknown> | null | undefined
): VoucherKind | null => {
  const kind = itemMetadata?.[VOUCHER_LINE_KEYS.kind]
  return kind === "electronic" || kind === "physical" ? kind : null
}

/** Stejná kontrola e-mailu jako při zakládání poukazu z objednávky. */
export const isValidVoucherEmail = (value: unknown): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim())

/**
 * Co na nastavení poukazu v košíku ještě chybí (česky), nebo `null`, když je
 * řádek hotový. Volá se před dokončením košíku — a je to jediná brána, která
 * cenu řádku porovná se zvolenou částkou: metadata umí přepsat i nativní
 * `POST /store/carts/:id/line-items/:line_id`, takže bez téhle kontroly by si
 * šel poukaz za 10 000 Kč odnést za nulu.
 */
export const giftVoucherSetupProblem = (input: {
  productMetadata: Record<string, unknown> | null | undefined
  itemMetadata: Record<string, unknown> | null | undefined
  unitPrice?: unknown
  currencyCode?: string | null
}): string | null => {
  if (!isGiftVoucherProduct(input.productMetadata)) return null

  if (!voucherLineKind(input.itemMetadata)) {
    return "Dárkový poukaz ještě není nastavený — v košíku zvolte prosím jeho podobu (elektronický, nebo vytištěný)."
  }

  const email = String(input.itemMetadata?.[VOUCHER_LINE_KEYS.recipientEmail] ?? "").trim()
  if (email && !isValidVoucherEmail(email)) {
    return "E-mail obdarovaného nevypadá správně — opravte ho prosím v košíku, nebo ho nechte prázdný."
  }

  if (!isCustomAmountVoucher(input.productMetadata)) return null

  if (voucherAmountPending(input.itemMetadata)) {
    return "Dárkový poukaz ještě nemá zvolenou hodnotu — zadejte ji prosím v košíku."
  }
  const result = validateVoucherAmount(
    input.itemMetadata?.[VOUCHER_AMOUNT_KEY],
    voucherConfig(input.productMetadata),
    input.currencyCode
  )
  if ("message" in result) return result.message
  if (input.unitPrice !== undefined && Number(input.unitPrice) !== result.amount) {
    return "Cena poukazu nesouhlasí se zvolenou hodnotou. Nastavte ho prosím v košíku znovu."
  }
  return null
}

export type GiftVoucherSetupInput = {
  kind?: unknown
  amount?: unknown
  recipient_name?: unknown
  recipient_email?: unknown
  dedication?: unknown
}

export type GiftVoucherSetupResult =
  | {
      ok: true
      kind: VoucherKind
      /** Nová cena řádku, nebo `null` u poukazu s pevnou hodnotou. */
      unitPrice: number | null
      /** Elektronický poukaz chodí e-mailem — položka nepotřebuje dopravu. */
      requiresShipping: boolean
      metadata: Record<string, string | number>
    }
  | { ok: false; message: string }

const trimTo = (value: unknown, max: number): string =>
  String(value ?? "").trim().slice(0, max)

/**
 * Vstup z formuláře v košíku → metadata řádku, cena a potřeba dopravy.
 *
 * Vrací VŠECHNY klíče, i prázdné: Medusa metadata slučuje, takže vynechaný
 * klíč by starou hodnotu nechal ležet — vymaže ji jen prázdný řetězec (past
 * z `cp_test_zip`). Kdo přepne elektronický poukaz na vytištěný, nesmí si
 * s sebou nést e-mail obdarovaného.
 */
export const giftVoucherSetup = (
  input: GiftVoucherSetupInput,
  context: {
    productMetadata: Record<string, unknown> | null | undefined
    currencyCode?: string | null
  }
): GiftVoucherSetupResult => {
  if (!isGiftVoucherProduct(context.productMetadata)) {
    return { ok: false, message: "Tahle položka není dárkový poukaz." }
  }

  const kind = input.kind === "electronic" || input.kind === "physical" ? input.kind : null
  if (!kind) {
    return {
      ok: false,
      message: "Zvolte prosím podobu poukazu — elektronický, nebo vytištěný.",
    }
  }

  const recipientName = trimTo(input.recipient_name, VOUCHER_RECIPIENT_NAME_MAX)
  const dedication = trimTo(input.dedication, VOUCHER_DEDICATION_MAX)
  /* E-mail má smysl jen u elektronického — vytištěný se předává v ruce. */
  const recipientEmail = kind === "electronic" ? trimTo(input.recipient_email, VOUCHER_EMAIL_MAX) : ""
  if (recipientEmail && !isValidVoucherEmail(recipientEmail)) {
    return {
      ok: false,
      message: "E-mail obdarovaného nevypadá správně — zkontrolujte ho prosím, nebo ho nechte prázdný.",
    }
  }

  const metadata: Record<string, string | number> = {
    [VOUCHER_LINE_KEYS.kind]: kind,
    [VOUCHER_LINE_KEYS.recipientName]: recipientName,
    [VOUCHER_LINE_KEYS.recipientEmail]: recipientEmail,
    [VOUCHER_LINE_KEYS.dedication]: dedication,
  }

  if (!isCustomAmountVoucher(context.productMetadata)) {
    return { ok: true, kind, unitPrice: null, requiresShipping: kind === "physical", metadata }
  }

  const amount = validateVoucherAmount(
    input.amount,
    voucherConfig(context.productMetadata),
    context.currencyCode
  )
  if ("message" in amount) return { ok: false, message: amount.message }

  metadata[VOUCHER_AMOUNT_KEY] = amount.amount
  return {
    ok: true,
    kind,
    unitPrice: amount.amount,
    requiresShipping: kind === "physical",
    metadata,
  }
}
