"use client"

import { useId, useState } from "react"

import {
  VOUCHER_DEDICATION_MAX,
  isValidVoucherEmail,
  type VoucherKind,
} from "@lib/util/gift-voucher-code"

import styles from "./style.module.scss"

/**
 * Formulář dárkového poukazu — podoba, pro koho, e-mail obdarovaného
 * a věnování.
 *
 * Od 30. 10. 2026 stojí v KOŠÍKU (`modules/cart/components/gift-voucher-setup`),
 * ne na stránce produktu: na produktu zákazník jen vybere poukaz a přidá ho do
 * košíku. Uložené hodnoty si drží položka košíku v metadatech a backend z nich
 * po zaplacení založí poukaz (`backend/src/lib/gift-voucher-orders.ts`).
 */

export type GiftVoucherFormValue = {
  kind: VoucherKind
  recipientName: string
  recipientEmail: string
  dedication: string
}

export const EMPTY_GIFT_VOUCHER_FORM: GiftVoucherFormValue = {
  kind: "electronic",
  recipientName: "",
  recipientEmail: "",
  dedication: "",
}

/** Chyba formuláře, nebo `null`, když jde poukaz do košíku. */
export const giftVoucherFormError = (value: GiftVoucherFormValue): string | null => {
  if (
    value.kind === "electronic" &&
    value.recipientEmail.trim() &&
    !isValidVoucherEmail(value.recipientEmail)
  ) {
    return "E-mail obdarovaného nevypadá správně — zkontrolujte ho prosím, nebo ho nechte prázdný."
  }
  if (value.dedication.length > VOUCHER_DEDICATION_MAX) {
    return `Věnování může mít nejvýš ${VOUCHER_DEDICATION_MAX} znaků.`
  }
  return null
}

type Props = {
  value: GiftVoucherFormValue
  onChange: (value: GiftVoucherFormValue) => void
  /** Ukázat chyby hned (po pokusu o přidání), ne až při psaní. */
  showErrors?: boolean
  disabled?: boolean
}

const KINDS: Array<{ value: VoucherKind; title: string; note: string }> = [
  { value: "electronic", title: "Elektronický", note: "pošlu ho e-mailem jako PDF" },
  /* Samotný poukaz se dopravcem neposílá (lib/util/fragile.ts) — vyzvedává se
     v ateliéru. Ve smíšeném košíku jede poštou se zbytkem objednávky. */
  { value: "physical", title: "Vytištěný", note: "přibalím ho k objednávce, nebo si ho vyzvednete" },
]

export default function GiftVoucherForm({
  value,
  onChange,
  showErrors = false,
  disabled = false,
}: Props) {
  const id = useId()
  const [emailTouched, setEmailTouched] = useState(false)
  const set = (patch: Partial<GiftVoucherFormValue>) => onChange({ ...value, ...patch })

  const emailInvalid =
    value.kind === "electronic" &&
    Boolean(value.recipientEmail.trim()) &&
    !isValidVoucherEmail(value.recipientEmail)
  /* E-mail se hlídá až po opuštění pole nebo po pokusu o přidání — uprostřed
     psaní je každá adresa „špatně". */
  const showEmailError = emailInvalid && (showErrors || emailTouched)
  const dedicationLeft = VOUCHER_DEDICATION_MAX - value.dedication.length

  return (
    <div className={styles.root} data-testid="gift-voucher-form">
      <fieldset className={styles.kinds} disabled={disabled}>
        <legend className={styles.label}>Podoba</legend>
        {KINDS.map((kind) => (
          <label key={kind.value} className={styles.kind}>
            <input
              type="radio"
              name={`${id}-kind`}
              value={kind.value}
              checked={value.kind === kind.value}
              onChange={() => set({ kind: kind.value })}
              data-testid={`gift-voucher-kind-${kind.value}`}
            />
            <span>
              <strong>{kind.title}</strong> — {kind.note}
            </span>
          </label>
        ))}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor={`${id}-name`} className={styles.label}>
          Pro koho <span className={styles.optional}>(nepovinné)</span>
        </label>
        <input
          id={`${id}-name`}
          type="text"
          className={styles.input}
          value={value.recipientName}
          maxLength={120}
          autoComplete="off"
          placeholder="Jméno obdarovaného"
          onChange={(event) => set({ recipientName: event.target.value })}
          disabled={disabled}
          data-testid="gift-voucher-recipient-name"
        />
      </div>

      {value.kind === "electronic" && (
        <div className={styles.field}>
          <label htmlFor={`${id}-email`} className={styles.label}>
            E-mail obdarovaného <span className={styles.optional}>(nepovinné)</span>
          </label>
          <input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            className={styles.input}
            value={value.recipientEmail}
            maxLength={320}
            autoComplete="off"
            placeholder="jana@example.cz"
            onChange={(event) => set({ recipientEmail: event.target.value })}
            onBlur={() => setEmailTouched(true)}
            disabled={disabled}
            aria-invalid={showEmailError || undefined}
            aria-describedby={`${id}-email-hint`}
            data-testid="gift-voucher-recipient-email"
          />
          <p
            id={`${id}-email-hint`}
            className={showEmailError ? styles.error : styles.hint}
            role={showEmailError ? "alert" : undefined}
          >
            {showEmailError
              ? "Tenhle e-mail nevypadá správně — zkontrolujte ho prosím."
              : "Když ho nevyplníte, poukaz přijde vám."}
          </p>
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor={`${id}-dedication`} className={styles.label}>
          Věnování <span className={styles.optional}>(nepovinné)</span>
        </label>
        <textarea
          id={`${id}-dedication`}
          className={styles.textarea}
          value={value.dedication}
          maxLength={VOUCHER_DEDICATION_MAX}
          rows={3}
          placeholder="Pár slov, která na poukazu budou"
          onChange={(event) => set({ dedication: event.target.value })}
          disabled={disabled}
          aria-describedby={`${id}-dedication-hint`}
          data-testid="gift-voucher-dedication"
        />
        <p id={`${id}-dedication-hint`} className={styles.hint}>
          {dedicationLeft < 100
            ? `Zbývá ${dedicationLeft} znaků.`
            : `Napíšu ho na poukaz. Nejvýš ${VOUCHER_DEDICATION_MAX} znaků.`}
        </p>
      </div>
    </div>
  )
}
