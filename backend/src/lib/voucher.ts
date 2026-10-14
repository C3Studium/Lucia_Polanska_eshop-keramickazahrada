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
