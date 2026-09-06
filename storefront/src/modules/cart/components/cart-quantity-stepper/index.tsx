"use client"

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
  "data-testid"?: string
}

const CartQuantityStepper = ({
  value,
  min = 1,
  max,
  disabled = false,
  onChange,
  decreaseLabel = "Snížit množství",
  "data-testid": dataTestId,
}: CartQuantityStepperProps) => {
  const decrease = () => value > min && onChange(value - 1)
  const increase = () => value < max && onChange(value + 1)

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
      <output className={styles.value} aria-live="polite">
        {value}
      </output>
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
