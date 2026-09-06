"use client"

import Input from "@modules/common/components/input"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import styles from "./style.module.scss"

/**
 * Telefon s předvolbou — jeden komponent pro každý formulář s číslem.
 *
 * Rozbaleník nabízí předvolby zemí, do kterých obchod vůbec prodává (regiony
 * Medusy — tytéž kódy, které stojí v adrese jako `/cz`, `/sk`, …), a výchozí
 * se bere právě z toho slugu v cestě: kdo nakupuje na `/sk`, začíná na +421.
 *
 * ## Jak se hodnota odevzdává
 *
 * Formuláře tu chodí dvěma cestami — FormData (nepodřízené vstupy) i stav
 * (checkout, rezervace). Obojí obsluhuje JEDNO složené číslo: skrytý input
 * nese `name` a hodnotu `+420 603 123 456`, viditelné pole jméno nemá vůbec.
 * Odeslání i server tak vidí totéž, co dřív — jeden řetězec — a nikde se
 * nemusí skládat ze dvou polí.
 *
 * Prázdné číslo znamená prázdnou hodnotu, ne osamocenou předvolbu: nepovinné
 * pole nesmí odesílat „+420" jen proto, že má rozbaleník.
 *
 * Když někdo vepíše vlastní mezinárodní tvar (začíná „+"), má přednost celý —
 * předvolba z rozbaleníku se nepřilepuje před něj.
 */

/** Předvolby zemí obchodu. Pořadí: domácí dvojice, pak vzestupně. */
export const PHONE_PREFIXES: { code: string; dial: string }[] = [
  { code: "cz", dial: "+420" },
  { code: "sk", dial: "+421" },
  { code: "fr", dial: "+33" },
  { code: "es", dial: "+34" },
  { code: "it", dial: "+39" },
  { code: "gb", dial: "+44" },
  { code: "dk", dial: "+45" },
  { code: "se", dial: "+46" },
  { code: "pl", dial: "+48" },
  { code: "de", dial: "+49" },
  { code: "si", dial: "+386" },
]

const FALLBACK_DIAL = "+420"

const dialForCountry = (code: string | undefined): string =>
  PHONE_PREFIXES.find((p) => p.code === code?.toLowerCase())?.dial ??
  FALLBACK_DIAL

/**
 * Rozdělí uložené číslo na předvolbu a zbytek.
 *
 * Delší předvolba se zkouší dřív (+421 před +42…), aby se slovenské číslo
 * nerozpadlo na +42 a jedničku. Číslo bez známé předvolby zůstane celé ve
 * viditelném poli a rozbaleník drží výchozí zemi.
 */
export const splitPhone = (
  value: string | null | undefined,
  fallbackDial: string
): { dial: string; number: string } => {
  const raw = (value ?? "").trim()
  if (!raw) return { dial: fallbackDial, number: "" }
  const byLength = [...PHONE_PREFIXES].sort(
    (a, b) => b.dial.length - a.dial.length
  )
  for (const { dial } of byLength) {
    if (raw.startsWith(dial)) {
      return { dial, number: raw.slice(dial.length).trim() }
    }
  }
  return { dial: fallbackDial, number: raw }
}

const compose = (dial: string, number: string): string => {
  const trimmed = number.trim()
  if (!trimmed) return ""
  // Vlastní mezinárodní tvar má přednost celý.
  if (trimmed.startsWith("+")) return trimmed
  return `${dial} ${trimmed}`
}

type ChangeLike = { target: { name: string; value: string } }

type PhoneInputProps = {
  /** Jméno SLOŽENÉHO pole — to jediné odchází ve FormData i v události. */
  name: string
  /** Řízený režim: celé číslo i s předvolbou. */
  value?: string
  /** Nepodřízený režim: výchozí celé číslo. */
  defaultValue?: string
  /** Změna složeného čísla — tvar události kvůli checkoutu (čte target.name/value). */
  onChange?: (event: ChangeLike) => void
  required?: boolean
  disabled?: boolean
  /**
   * S popiskem se číslo kreslí sdíleným `Input` (plovoucí popisek, varianty).
   * Bez něj se vykreslí holý `<input>`, který si formulář ostyluje sám přes
   * `inputClassName` nebo selektor na element — pro formuláře s vlastní řečí
   * (kontakt, rezervace, express checkout).
   */
  label?: string
  variant?: "default" | "contact"
  topLabel?: string
  className?: string
  inputClassName?: string
  id?: string
  placeholder?: string
  autoComplete?: string
  "data-testid"?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

export default function PhoneInput({
  name,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  label,
  variant = "default",
  topLabel,
  className,
  inputClassName,
  id,
  placeholder,
  autoComplete = "tel-national",
  ...rest
}: PhoneInputProps) {
  const params = useParams()
  const countryCode =
    typeof params?.countryCode === "string" ? params.countryCode : undefined
  const pathDial = dialForCountry(countryCode)

  const controlled = value !== undefined

  /*
   * Vnitřní stav drží OBĚ půlky. V řízeném režimu se číslo bere z `value`
   * (rozdělené), ale zvolená předvolba se pamatuje i ve chvíli, kdy je číslo
   * prázdné — složená hodnota je pak "" a z ní by se volba nedala přečíst
   * zpátky.
   */
  const initial = useMemo(
    () => splitPhone(controlled ? value : defaultValue, pathDial),
    // Jen pro první render; dál řídí stav / value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const [dial, setDial] = useState(initial.dial)
  const [number, setNumber] = useState(initial.number)

  const shown = controlled ? splitPhone(value, dial) : { dial, number }

  const emit = (nextDial: string, nextNumber: string) => {
    setDial(nextDial)
    setNumber(nextNumber)
    onChange?.({ target: { name, value: compose(nextDial, nextNumber) } })
  }

  const composed = compose(shown.dial, shown.number)

  const numberField = label ? (
    <Input
      label={label}
      // Bez `name` — složené číslo nese skrytý input níž; dvě pole v datech
      // by znamenala dvě verze pravdy.
      name={`${name}__cislo`}
      type="tel"
      autoComplete={autoComplete}
      required={required}
      disabled={disabled}
      variant={variant}
      topLabel={topLabel}
      value={shown.number}
      onChange={(e) => emit(shown.dial, e.target.value)}
      id={id}
      {...rest}
    />
  ) : (
    <input
      type="tel"
      autoComplete={autoComplete}
      required={required}
      disabled={disabled}
      className={inputClassName}
      value={shown.number}
      onChange={(e) => emit(shown.dial, e.target.value)}
      id={id}
      placeholder={placeholder}
      {...rest}
    />
  )

  return (
    <div
      className={`${styles.row} ${label ? styles.rowTall : ""} ${className ?? ""}`}
    >
      <select
        className={`${styles.dial} ${label ? styles.dialTall : ""}`}
        aria-label="Telefonní předvolba"
        value={shown.dial}
        disabled={disabled}
        onChange={(e) => emit(e.target.value, shown.number)}
      >
        {PHONE_PREFIXES.map((p) => (
          <option key={p.code} value={p.dial}>
            {p.dial}
          </option>
        ))}
      </select>

      <div className={styles.number}>{numberField}</div>

      {/* Jediné pojmenované pole — složené číslo pro FormData. */}
      <input type="hidden" name={name} value={composed} />
    </div>
  )
}
