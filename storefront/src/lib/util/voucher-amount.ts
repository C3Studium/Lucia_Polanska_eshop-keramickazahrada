/**
 * Dárkový poukaz s vlastní částkou — meze a kontrola zvolené hodnoty.
 *
 * Pravidla jsou KOPIE backendových (`backend/src/lib/voucher.ts`): meze
 * z `product.metadata`, výchozí 100 / 10 000 / 100 Kč, krok počítaný od
 * minima. Tady jen kvůli okamžité odezvě — rozhoduje backend.
 *
 * Čistý modul bez „use client": čte z něj i košík vykreslovaný na serveru
 * (jestli poukaz ještě není nastavený), a funkce z klientského modulu by se
 * tam zavolat nedala.
 */

export const VOUCHER_DEFAULTS = { min: 100, max: 10000, step: 100, currency: "czk" }

export type VoucherConfig = typeof VOUCHER_DEFAULTS

const positiveInt = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim())
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

/** Je produkt poukaz s vlastní částkou (`metadata.voucher_custom_amount`)? */
export const isCustomAmountVoucher = (
  metadata: Record<string, unknown> | null | undefined
): boolean =>
  metadata?.voucher_custom_amount === true || metadata?.voucher_custom_amount === "true"

export const voucherConfig = (
  metadata: Record<string, unknown> | null | undefined
): VoucherConfig => {
  const min = positiveInt(metadata?.voucher_min) ?? VOUCHER_DEFAULTS.min
  const maxRaw = positiveInt(metadata?.voucher_max) ?? VOUCHER_DEFAULTS.max
  const max = maxRaw >= min ? maxRaw : Math.max(min, VOUCHER_DEFAULTS.max)
  const step = positiveInt(metadata?.voucher_step) ?? VOUCHER_DEFAULTS.step
  const currencyRaw = metadata?.voucher_currency
  const currency =
    typeof currencyRaw === "string" && /^[a-z]{3}$/i.test(currencyRaw.trim())
      ? currencyRaw.trim().toLowerCase()
      : VOUCHER_DEFAULTS.currency
  return { min, max, step, currency }
}

export const voucherUnitOf = (currency: string) =>
  currency === "czk" ? "Kč" : currency === "eur" ? "€" : currency.toUpperCase()

export const formatVoucherInt = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ")

export type VoucherCheck = { ok: true; amount: number } | { ok: false; message: string }

/** Stejná pravidla i hlášky jako `validateVoucherAmount` v backendu. */
export const checkVoucherAmount = (
  raw: string,
  config: VoucherConfig,
  currencyCode: string
): VoucherCheck => {
  const unit = voucherUnitOf(config.currency)
  if (currencyCode.toLowerCase() !== config.currency) {
    return {
      ok: false,
      message: `Dárkový poukaz s vlastní částkou lze zatím koupit jen v měně ${unit}.`,
    }
  }
  const text = raw.trim().replace(/\s+/g, "")
  if (!text) return { ok: false, message: "Zadejte prosím částku poukazu." }
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
      message: `Částka poukazu musí být od ${formatVoucherInt(config.min)} do ${formatVoucherInt(config.max)} ${unit}.`,
    }
  }
  if ((amount - config.min) % config.step !== 0) {
    return {
      ok: false,
      message: `Částku poukazu zadejte po ${formatVoucherInt(config.step)} ${unit} (např. ${formatVoucherInt(config.min)}, ${formatVoucherInt(config.min + config.step)} …).`,
    }
  }
  return { ok: true, amount }
}
