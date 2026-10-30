"use client"

import { useId } from "react"

import {
  checkVoucherAmount,
  formatVoucherInt,
  voucherUnitOf,
  type VoucherConfig,
} from "@lib/util/voucher-amount"

import styles from "./style.module.scss"

/**
 * Pole pro hodnotu dárkového poukazu s vlastní částkou.
 *
 * Od 30. 10. 2026 stojí v KOŠÍKU (`modules/cart/components/gift-voucher-setup`),
 * ne na stránce produktu: zákazník si nejdřív vybere poukaz a teprve pak řeší,
 * za kolik má být a komu je. Zvolená částka jde na backend, který z ní udělá
 * cenu řádku (`lib/voucher.ts` + krok `get-custom-price`), takže košík,
 * pokladna, objednávka i platba ukazují tutéž částku.
 *
 * Pravidla (meze, krok, měna) jsou v `@lib/util/voucher-amount` — čistý modul,
 * ze kterého čte i košík vykreslovaný na serveru.
 */

type VoucherAmountFieldProps = {
  config: VoucherConfig
  currencyCode: string
  value: string
  onChange: (value: string) => void
  /** Ukázat chybu hned (po pokusu o uložení), ne až při psaní. */
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
  const unit = voucherUnitOf(config.currency)
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
          placeholder={`např. ${formatVoucherInt(Math.min(config.max, Math.max(config.min, 1000)))}`}
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
          `Od ${formatVoucherInt(config.min)} do ${formatVoucherInt(config.max)} ${unit}, po ${formatVoucherInt(config.step)} ${unit}. Zvolená částka je cena poukazu v košíku.`}
      </p>
    </div>
  )
}
