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
}

/**
 * Tells the customer, before they commit, that this piece is made for them: how long it takes
 * and what they pay now. The deposit percentage is the backend's — a variant's override beats
 * the product default — but the *amount* shown is derived only for display; the checkout never
 * re-derives it (§4.3 reads the API's figures).
 *
 * Deliberately information-only: the description of the piece (and its photos) is written in
 * the cart, next to the deposit chooser, so the product page stays a decision, not a form.
 */
export default function MadeToOrderPanel({
  profile,
  variantId,
  unitAmount,
  currencyCode,
}: MadeToOrderPanelProps) {
  const fieldId = useId()
  const leadTime = productionTimeLabel(profile)
  const depositPercentage = depositPercentageFor(profile, variantId)
  const depositAmount =
    depositPercentage != null && unitAmount != null
      ? Math.round((unitAmount * depositPercentage) / 100)
      : null

  return (
    <section className={styles.root} aria-labelledby={`${fieldId}-title`}>
      <p className={styles.eyebrow} id={`${fieldId}-title`}>
        Vyrábí se na zakázku
      </p>

      {leadTime && <p className={styles.lead}>Hotovo zhruba za {leadTime}.</p>}

      {depositPercentage != null && (
        <p className={styles.deposit}>
          Platí se záloha {depositPercentage} %
          {depositAmount != null && (
            <> — {convertToLocale({ amount: depositAmount, currency_code: currencyCode })}</>
          )}
          . Zbytek doplatíte, až bude hotovo.
        </p>
      )}

      <p className={styles.lead}>
        Popis a fotky k zakázce přiložíte v košíku.
      </p>
    </section>
  )
}
