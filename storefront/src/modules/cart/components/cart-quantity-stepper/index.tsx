"use client"

import { useState } from "react"

import styles from "./style.module.scss"

type CartQuantityStepperProps = {
  value: number
  min?: number
  max: number
  disabled?: boolean
  onChange: (quantity: number) => void
  /* Když `min` je 0, mínus u jedničky položku odebírá — a to musí říct
     i čtečce, jinak slibuje snížení množství a udělá něco jiného. */
  decreaseLabel?: string
  /* Když je zapnuté, číslo mezi −/+ jde i přepsat z klávesnice. Spodní
     hranice přepisu je VŽDY 1, ne `min`: `min: 0` slouží jen mínusku, aby
     poslední kus odebral — přepsat množství na nulu by položku odstranilo
     nečekaně, takže to nedovolíme. */
  editable?: boolean
  "data-testid"?: string
}

const CartQuantityStepper = ({
  value,
  min = 1,
  max,
  disabled = false,
  onChange,
  decreaseLabel = "Snížit množství",
  editable = false,
  "data-testid": dataTestId,
}: CartQuantityStepperProps) => {
  const decrease = () => value > min && onChange(value - 1)
  const increase = () => value < max && onChange(value + 1)

  /*
   * Rozepsané číslo drží jen jako text, dokud se píše — číslici po číslici,
   * bez ořezu na každý stisk. `null` znamená „needituje se", tedy zobraz
   * živou hodnotu z propu. Potvrdí se až na blur / Enter.
   */
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft === null) return
    const parsed = Number.parseInt(draft, 10)
    if (!Number.isNaN(parsed)) {
      /* Spodní hranice je 1, i když `min` je 0 (viz komentář u propu). */
      const clamped = Math.min(Math.max(parsed, Math.max(min, 1)), max)
      if (clamped !== value) {
        onChange(clamped)
      }
    }
    /* Prázdné nebo neplatné pole se vrátí k původní hodnotě — nikdy ne 0. */
    setDraft(null)
  }

  return (
    <div
      className={styles.root}
      role="group"
      aria-label="Množství produktu"
      data-testid={dataTestId}
    >
      <button
        type="button"
        className={styles.control}
        onClick={decrease}
        disabled={disabled || value <= min}
        aria-label={decreaseLabel}
      >
        −
      </button>
      {editable ? (
        <input
          type="text"
          inputMode="numeric"
          className={`${styles.value} ${styles.valueInput}`}
          value={draft ?? String(value)}
          disabled={disabled}
          aria-label="Množství"
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            } else if (e.key === "Escape") {
              e.preventDefault()
              setDraft(null)
            }
          }}
        />
      ) : (
        <output className={styles.value} aria-live="polite">
          {value}
        </output>
      )}
      <button
        type="button"
        className={styles.control}
        onClick={increase}
        disabled={disabled || value >= max}
        aria-label="Zvýšit množství"
      >
        +
      </button>
    </div>
  )
}

export default CartQuantityStepper
