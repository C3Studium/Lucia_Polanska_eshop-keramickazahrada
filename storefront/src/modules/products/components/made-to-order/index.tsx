"use client"

import { useId } from "react"

import {
  depositPercentageFor,
  productionTimeLabel,
  type ProductionProfile,
} from "@lib/util/made-to-order"
import { convertToLocale } from "@lib/util/money"

import styles from "./style.module.scss"

type MadeToOrderPanelProps = {
  profile: ProductionProfile
  variantId?: string | null
  /** Unit price of the selected variant, so the deposit can be shown as an amount. */
  unitAmount?: number | null
  currencyCode: string
  specification: string
  onSpecificationChange: (value: string) => void
  /** True once the customer has tried to add without filling the specification. */
  showRequiredError?: boolean
}

/**
 * Tells the customer, before they commit, that this piece is made for them: how long it takes,
 * what they pay now, and what they describe. The deposit percentage is the backend's — a
 * variant's override beats the product default — but the *amount* shown is derived only for
 * display; the checkout never re-derives it (§4.3 reads the API's figures).
 */
export default function MadeToOrderPanel({
  profile,
  variantId,
  unitAmount,
  currencyCode,
  specification,
  onSpecificationChange,
  showRequiredError = false,
}: MadeToOrderPanelProps) {
  const fieldId = useId()
  const leadTime = productionTimeLabel(profile)
  const depositPercentage = depositPercentageFor(profile, variantId)
  const depositAmount =
    depositPercentage != null && unitAmount != null
      ? Math.round((unitAmount * depositPercentage) / 100)
      : null

  const isMissing = showRequiredError && !specification.trim()

  return (
    <section className={styles.root} aria-labelledby={`${fieldId}-title`}>
      <p className={styles.eyebrow} id={`${fieldId}-title`}>
        Vyrábí se na zakázku
      </p>

      {leadTime && <p className={styles.lead}>Hotovo zhruba za {leadTime}.</p>}

      {depositPercentage != null && (
        <p className={styles.deposit}>
          Nyní zaplatíte zálohu {depositPercentage} %
          {depositAmount != null && (
            <> — {convertToLocale({ amount: depositAmount, currency_code: currencyCode })}</>
          )}
          . Zbytek doplatíte, až bude hotovo.
        </p>
      )}

      {profile.specification_required && (
        <div className={styles.field}>
          <label htmlFor={fieldId}>
            {profile.specification_prompt || "Napište, co si představujete"}{" "}
            <i>(povinné)</i>
          </label>
          <textarea
            id={fieldId}
            className={styles.input}
            value={specification}
            onChange={(event) => onSpecificationChange(event.target.value)}
            rows={4}
            required
            aria-describedby={isMissing ? `${fieldId}-error` : undefined}
            aria-invalid={isMissing || undefined}
            placeholder="Rozměry, barva glazury, nápis, do kdy to potřebujete…"
          />
          {isMissing && (
            <p className={styles.error} id={`${fieldId}-error`} role="alert">
              Bez pár řádků nevíme, co máme vyrobit.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
