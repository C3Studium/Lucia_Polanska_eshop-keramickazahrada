"use client"

import { useId, useState, useTransition } from "react"

import { convertToLocale } from "@lib/util/money"
import type { ProductionPaymentMode } from "@lib/util/made-to-order"

import styles from "./style.module.scss"

type Props = {
  initial: ProductionPaymentMode
  /** Persists the choice on the cart; returns the backend's updated figures. */
  onSelect: (mode: "deposit" | "full") => Promise<ProductionPaymentMode | null>
}

/**
 * Deposit or pay in full, for a cart containing a commissioned piece.
 *
 * Every figure shown comes back from the API. The checkout deliberately does no arithmetic:
 * two implementations of the same sum drift, and the number the customer reads has to be the
 * number they are charged.
 */
export default function ProductionPaymentModeChoice({ initial, onSelect }: Props) {
  const [state, setState] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const name = useId()

  if (!state.has_made_to_order) {
    return null
  }

  const currency_code = state.currency_code ?? "czk"
  const money = (amount: number) => convertToLocale({ amount, currency_code })

  const choose = (mode: "deposit" | "full") => {
    if (mode === state.mode || isPending) return

    // Optimistic, then corrected by whatever the backend returns.
    setState((current) => ({ ...current, mode }))
    startTransition(async () => {
      const updated = await onSelect(mode)
      if (updated) setState(updated)
    })
  }

  return (
    <fieldset className={styles.root} disabled={isPending}>
      <legend className={styles.legend}>Jak chcete zakázku zaplatit?</legend>

      <label className={state.mode === "deposit" ? styles.optionActive : styles.option}>
        <input
          type="radio"
          name={name}
          value="deposit"
          checked={state.mode === "deposit"}
          onChange={() => choose("deposit")}
        />
        <span>
          Zaplatit zálohu <strong>{money(state.deposit_amount)}</strong> — zbytek{" "}
          {money(state.balance_later)} doplatíte, až bude hotovo.
        </span>
      </label>

      {state.can_pay_full && (
        <label className={state.mode === "full" ? styles.optionActive : styles.option}>
          <input
            type="radio"
            name={name}
            value="full"
            checked={state.mode === "full"}
            onChange={() => choose("full")}
          />
          <span>
            Zaplatit rovnou celou částku <strong>{money(state.full_amount)}</strong> — pak
            už nic neřešíte.
          </span>
        </label>
      )}
    </fieldset>
  )
}
