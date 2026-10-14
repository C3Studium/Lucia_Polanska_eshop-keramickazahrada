"use client"

import { useId } from "react"

import styles from "./style.module.scss"

/**
 * Dárkový poukaz s vlastní částkou — pole místo pevné ceny na stránce
 * produktu (právní audit § 5). Zvolená částka jde do košíku jako
 * `metadata.voucher_amount` a backend z ní udělá cenu řádku
 * (`backend/src/lib/voucher.ts` + krok `get-custom-price`), takže košík,
 * pokladna, objednávka i platba ukazují tutéž částku.
 *
 * Pravidla jsou KOPIE backendových (meze z `product.metadata`, výchozí
 * 100 / 10 000 / 100 Kč, krok počítaný od minima). Tady jen kvůli okamžité
 * odezvě — rozhoduje backend.
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

const unitOf = (currency: string) =>
  currency === "czk" ? "Kč" : currency === "eur" ? "€" : currency.toUpperCase()

const formatInt = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ")

export type VoucherCheck = { ok: true; amount: number } | { ok: false; message: string }

/** Stejná pravidla i hlášky jako `validateVoucherAmount` v backendu. */
export const checkVoucherAmount = (
  raw: string,
  config: VoucherConfig,
  currencyCode: string
): VoucherCheck => {
  const unit = unitOf(config.currency)
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

type VoucherAmountFieldProps = {
  config: VoucherConfig
  currencyCode: string
  value: string
  onChange: (value: string) => void
  /** Ukázat chybu hned (po pokusu o přidání), ne až při psaní. */
  showError?: boolean
  disabled?: boolean
}

export default function VoucherAmountField({
  config,
  currencyCode,
  value,
  onChange,
  showError = false,
  disabled = false,
}: VoucherAmountFieldProps) {
  const id = useId()
  const unit = unitOf(config.currency)
  const check = checkVoucherAmount(value, config, currencyCode)
  const wrongCurrency = currencyCode.toLowerCase() !== config.currency
  const message = !check.ok && (showError || wrongCurrency || value.trim()) ? check.message : null

  return (
    <div className={styles.root} data-testid="voucher-amount">
      <label htmlFor={id} className={styles.label}>
        Hodnota poukazu
      </label>
      <div className={styles.field}>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={config.min}
          max={config.max}
          step={config.step}
          placeholder={`např. ${formatInt(Math.min(config.max, Math.max(config.min, 1000)))}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || wrongCurrency}
          aria-invalid={Boolean(message) || undefined}
          aria-describedby={`${id}-hint`}
          className={styles.input}
          data-testid="voucher-amount-input"
        />
        <span className={styles.unit} aria-hidden="true">
          {unit}
        </span>
      </div>
      <p id={`${id}-hint`} className={message ? styles.error : styles.hint} role={message ? "alert" : undefined}>
        {message ??
          `Od ${formatInt(config.min)} do ${formatInt(config.max)} ${unit}, po ${formatInt(config.step)} ${unit}. Zvolená částka je cena poukazu v košíku.`}
      </p>
    </div>
  )
}
