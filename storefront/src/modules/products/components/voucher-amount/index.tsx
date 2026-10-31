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
 * Stojí pod řádkem poukazu v košíku (`modules/cart/components/gift-voucher-setup`):
 * zákazník si nejdřív vybere poukaz a teprve pak řeší, za kolik má být a komu
 * je. Zvolená částka jde na backend, který z ní udělá cenu řádku
 * (`lib/voucher.ts` + krok `get-custom-price`), takže košík, pokladna,
 * objednávka i platba ukazují tutéž částku.
 *
 * Pravidla (meze, krok, měna) jsou v `@lib/util/voucher-amount` — čistý modul,
 * ze kterého čte i košík vykreslovaný na serveru.
 *
 * Od 31. 10. 2026 je pole NÍZKÉ a v jedné lince s nabídnutými částkami: sedí
 * uvnitř položky košíku, ne na stránce výrobku místo ceny, takže z něj velké
 * serifové číslo přes celou šířku udělalo nejvyšší kus celého košíku.
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

/** Obvyklé částky — ať se nejčastější hodnoty nemusí vyťukávat. */
const PRESET_CANDIDATES = [500, 1000, 2000, 3000, 5000]

/**
 * Tři nabídnuté částky, které do mezí poukazu opravdu padnou. Když se jich
 * z obvyklých nenajde dost (jiná měna, netypický krok), nabídnou se meze
 * a střed — vždycky hodnota, kterou kontrola vezme.
 */
export const voucherPresets = (config: VoucherConfig): number[] => {
  const fits = (value: number) =>
    value >= config.min &&
    value <= config.max &&
    (value - config.min) % config.step === 0
  const usual = PRESET_CANDIDATES.filter(fits)
  if (usual.length >= 2) return usual.slice(0, 3)

  const steps = Math.floor((config.max - config.min) / config.step)
  const middle = config.min + Math.floor(steps / 2) * config.step
  return [config.min, middle, config.max].filter(
    (value, index, all) => all.indexOf(value) === index
  )
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
  const chosen = check.ok ? check.amount : null

  return (
    <div className={styles.root} data-testid="voucher-amount">
      <label htmlFor={id} className={styles.label}>
        Hodnota
      </label>
      <div className={styles.controls}>
        <span className={styles.field}>
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={config.min}
            max={config.max}
            step={config.step}
            /* Holé číslo, ne „např. 1 000“ — do úzkého pole vedle popisku se
               celá věta nevejde. Že je to nápověda a ne vyplněná hodnota,
               říká ztlumená barva (`::placeholder` ve stylech). */
            placeholder={formatVoucherInt(
              Math.min(config.max, Math.max(config.min, 1000))
            )}
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
        </span>
        {/* Nabídnuté částky: jedno kliknutí místo vyťukávání. Zvolená je
            zvýrazněná, takže je i vidět, co v poli stojí. */}
        <span className={styles.presets}>
          {voucherPresets(config).map((preset) => (
            <button
              key={preset}
              type="button"
              className={styles.preset}
              aria-pressed={chosen === preset}
              onClick={() => onChange(String(preset))}
              disabled={disabled || wrongCurrency}
              data-testid={`voucher-amount-preset-${preset}`}
            >
              {formatVoucherInt(preset)}
            </button>
          ))}
        </span>
      </div>
      <p
        id={`${id}-hint`}
        className={message ? styles.error : styles.hint}
        role={message ? "alert" : undefined}
      >
        {message ??
          `Od ${formatVoucherInt(config.min)} do ${formatVoucherInt(config.max)} ${unit}, po ${formatVoucherInt(config.step)}.`}
      </p>
    </div>
  )
}
