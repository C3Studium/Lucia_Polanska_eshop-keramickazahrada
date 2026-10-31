"use client"

import { clx } from "@medusajs/ui"
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
 * Stojí pod řádkem poukazu v KOŠÍKU (`modules/cart/components/gift-voucher-setup`),
 * ne na stránce produktu: na produktu zákazník jen vybere poukaz a přidá ho do
 * košíku. Uložené hodnoty si drží položka košíku v metadatech a backend z nich
 * po zaplacení založí poukaz (`backend/src/lib/gift-voucher-orders.ts`).
 *
 * Od 31. 10. 2026 je NÍZKÝ: podoba jsou dvě pilulky na jedné lince a tři
 * nepovinná pole se otevřou až na vyžádání. Pět polí pod sebou dělalo
 * z jedné položky košíku půl obrazovky, a čtyři z nich vyplňuje málokdo.
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
  { value: "electronic", title: "Elektronický", note: "e-mailem" },
  /* Vytištěný poukaz se od 31. 10. 2026 posílá i dopravcem — majitelka ho
     přibalí k objednávce, nebo si ho zákazník vyzvedne v ateliéru. */
  { value: "physical", title: "Vytištěný", note: "poštou i osobně" },
]

export default function GiftVoucherForm({
  value,
  onChange,
  showErrors = false,
  disabled = false,
}: Props) {
  const id = useId()
  const [emailTouched, setEmailTouched] = useState(false)
  /* Nepovinná pole: otevřená jen tomu, kdo si je vyžádal — nebo tomu, kdo
     v nich už něco uloženého má (úprava poukazu). */
  const [more, setMore] = useState(
    () => Boolean(value.recipientName || value.recipientEmail || value.dedication)
  )
  const set = (patch: Partial<GiftVoucherFormValue>) => onChange({ ...value, ...patch })

  const emailInvalid =
    value.kind === "electronic" &&
    Boolean(value.recipientEmail.trim()) &&
    !isValidVoucherEmail(value.recipientEmail)
  /* E-mail se hlídá až po opuštění pole nebo po pokusu o přidání — uprostřed
     psaní je každá adresa „špatně". */
  const showEmailError = emailInvalid && (showErrors || emailTouched)
  /* Chybu nejde nechat za zavřeným blokem — kdo ji má opravit, musí na to
     pole vidět. */
  const open = more || showEmailError
  const dedicationLeft = VOUCHER_DEDICATION_MAX - value.dedication.length

  return (
    <div className={styles.root} data-testid="gift-voucher-form">
      <div className={styles.row}>
        <span className={styles.label} id={`${id}-kind-label`}>
          Podoba
        </span>
        <div className={styles.kinds} role="radiogroup" aria-labelledby={`${id}-kind-label`}>
          {KINDS.map((kind) => (
            <label key={kind.value} className={styles.kind}>
              <input
                type="radio"
                className={styles.radio}
                name={`${id}-kind`}
                value={kind.value}
                checked={value.kind === kind.value}
                onChange={() => set({ kind: kind.value })}
                disabled={disabled}
                data-testid={`gift-voucher-kind-${kind.value}`}
              />
              <span className={styles.chip}>
                {kind.title} <small>{kind.note}</small>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.row}>
        {/* Jen zarovnání s popiskem „Podoba“ — ve sloupci pod sebou by to byl
            nadpis nad tlačítkem, které se samo umí pojmenovat. */}
        <span className={clx(styles.label, styles.labelGhost)} aria-hidden="true">
          Komu
        </span>
        <div className={styles.moreWrap}>
          <button
            type="button"
            className={styles.more}
            onClick={() => setMore((open) => !open)}
            aria-expanded={open}
            aria-controls={`${id}-optional`}
            disabled={disabled}
            data-testid="gift-voucher-more"
          >
            {open ? "Skrýt" : "Jméno, e-mail a věnování"}
            <span className={styles.optionalTag}>nepovinné</span>
          </button>
        </div>
      </div>

      <div id={`${id}-optional`} className={styles.optional} hidden={!open}>
        <div className={styles.field}>
          <label htmlFor={`${id}-name`} className={styles.subLabel}>
            Pro koho
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
            <label htmlFor={`${id}-email`} className={styles.subLabel}>
              E-mail obdarovaného
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
              aria-describedby={`${id}-hint`}
              data-testid="gift-voucher-recipient-email"
            />
          </div>
        )}

        <div className={clx(styles.field, styles.wide)}>
          <label htmlFor={`${id}-dedication`} className={styles.subLabel}>
            Věnování
          </label>
          <textarea
            id={`${id}-dedication`}
            className={styles.textarea}
            value={value.dedication}
            maxLength={VOUCHER_DEDICATION_MAX}
            rows={2}
            placeholder="Pár slov, která na poukazu budou"
            onChange={(event) => set({ dedication: event.target.value })}
            disabled={disabled}
            aria-describedby={`${id}-hint`}
            data-testid="gift-voucher-dedication"
          />
        </div>

        {/* Jedna věta pro obě pole — dvě nápovědy pod dvěma poli byly dva
            řádky navíc za totéž. */}
        <p
          id={`${id}-hint`}
          className={clx(styles.wide, showEmailError ? styles.error : styles.hint)}
          role={showEmailError ? "alert" : undefined}
        >
          {showEmailError
            ? "Tenhle e-mail nevypadá správně — zkontrolujte ho prosím."
            : dedicationLeft < 100
              ? `Zbývá ${dedicationLeft} znaků věnování.`
              : value.kind === "electronic"
                ? "Bez e-mailu přijde poukaz vám. Věnování na něj vytisknu."
                : "Věnování na poukaz vytisknu."}
        </p>
      </div>
    </div>
  )
}
