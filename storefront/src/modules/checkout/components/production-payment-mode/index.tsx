"use client"

import { useEffect, useId, useRef, useState, useTransition } from "react"

import { convertToLocale } from "@lib/util/money"
import type {
  ProductionPaymentMode,
  ProductionPaymentModeKind,
} from "@lib/util/made-to-order"

import styles from "./style.module.scss"

type Props = {
  initial: ProductionPaymentMode
  /** Persists the choice on the cart; returns the backend's updated figures. */
  onSelect: (
    mode: ProductionPaymentModeKind,
    amount?: number
  ) => Promise<ProductionPaymentMode | null>
  /** The cart shows this as a heads-up; checkout shows it as the decision. */
  variant?: "cart" | "checkout"
}

/**
 * How much of a commissioned piece to pay now.
 *
 * There is deliberately no "pay later": the floor is the deposit the owner set per product,
 * because she buys materials before she starts. Above that line the customer is free — half,
 * three quarters, all of it — so the control is a slider between her minimum and the full
 * amount, not two buttons.
 *
 * Every figure comes from the API and the slider is only a courtesy: the route re-clamps the
 * amount against the basket as it stands when payment is prepared. The checkout does no
 * arithmetic of its own, because two implementations of the same sum drift and the number the
 * customer reads has to be the number they are charged.
 */
export default function ProductionPaymentModeChoice({
  initial,
  onSelect,
  variant = "checkout",
}: Props) {
  const [state, setState] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const bounds = state.custom
  // Tracks the handle while dragging; the cart is only told once the drag ends.
  const [draft, setDraft] = useState<number>(bounds?.amount ?? 0)
  const commitTimer = useRef<number | undefined>(undefined)
  const sliderId = useId()

  // The basket can change under it — a line added elsewhere moves the floor.
  useEffect(() => {
    setState(initial)
    if (initial.custom) setDraft(initial.custom.amount)
  }, [initial])

  useEffect(
    () => () => {
      if (commitTimer.current) window.clearTimeout(commitTimer.current)
    },
    []
  )

  if (!state.has_made_to_order || !bounds) {
    return null
  }

  const currency_code = state.currency_code ?? "czk"
  const money = (amount: number) => convertToLocale({ amount, currency_code })

  const span = Math.max(0, bounds.maximum - bounds.minimum)
  const outstanding = Math.max(0, state.full_amount - draft)
  const atFloor = draft <= bounds.minimum
  const atCeiling = draft >= bounds.maximum

  const commit = (amount: number) => {
    // The ends are their own modes so the cart records the intent, not just a number that
    // happens to sit on the boundary today.
    const mode: ProductionPaymentModeKind =
      amount >= bounds.maximum && state.can_pay_full
        ? "full"
        : amount <= bounds.minimum
        ? "deposit"
        : "custom"

    startTransition(async () => {
      const updated = await onSelect(mode, amount)
      if (updated) {
        setState(updated)
        if (updated.custom) setDraft(updated.custom.amount)
      }
    })
  }

  const onSlide = (next: number) => {
    setDraft(next)
    if (commitTimer.current) window.clearTimeout(commitTimer.current)
    commitTimer.current = window.setTimeout(() => commit(next), 400)
  }

  const jump = (amount: number) => {
    if (commitTimer.current) window.clearTimeout(commitTimer.current)
    setDraft(amount)
    commit(amount)
  }

  return (
    <section
      className={variant === "cart" ? styles.rootCart : styles.root}
      aria-busy={isPending || undefined}
      data-testid="production-payment-mode"
    >
      <header className={styles.header}>
        <p className={styles.eyebrow}>Zakázková výroba</p>
        <h3 className={styles.heading} id={`${sliderId}-label`}>
          Kolik chcete zaplatit hned?
        </h3>
        <p className={styles.lede}>
          Nejméně {money(bounds.minimum)} — z toho nakoupím materiál a pustím se
          do práce. Víc je jen na vás.
        </p>
      </header>

      <output className={styles.amount} htmlFor={sliderId}>
        <strong data-testid="production-payment-amount">{money(draft)}</strong>
        <span>
          {outstanding > 0
            ? `zbývá ${money(outstanding)} — doplatíte, až bude hotovo`
            : "celá částka, pak už nic neřešíte"}
        </span>
      </output>

      <input
        id={sliderId}
        className={styles.slider}
        type="range"
        min={bounds.minimum}
        max={bounds.maximum}
        step={1}
        value={draft}
        disabled={isPending || span === 0}
        aria-labelledby={`${sliderId}-label`}
        aria-valuetext={money(draft)}
        onChange={(event) => onSlide(Number(event.target.value))}
        data-testid="production-payment-slider"
      />

      <div className={styles.scale} aria-hidden="true">
        <span>{money(bounds.minimum)}</span>
        <span>{money(bounds.maximum)}</span>
      </div>

      <div className={styles.presets}>
        <button
          type="button"
          className={atFloor ? styles.presetActive : styles.preset}
          onClick={() => jump(bounds.minimum)}
          disabled={isPending}
          data-testid="production-preset-deposit"
        >
          Jen zálohu
        </button>
        {span > 0 && (
          <button
            type="button"
            className={styles.preset}
            onClick={() =>
              jump(Math.round((bounds.minimum + bounds.maximum) / 2))
            }
            disabled={isPending}
            data-testid="production-preset-half"
          >
            Půlku
          </button>
        )}
        {state.can_pay_full && (
          <button
            type="button"
            className={atCeiling ? styles.presetActive : styles.preset}
            onClick={() => jump(bounds.maximum)}
            disabled={isPending}
            data-testid="production-preset-full"
          >
            Celou částku
          </button>
        )}
      </div>
    </section>
  )
}
