import {
  capturedTotal,
  MONEY_EPSILON,
  type MoneyOrder,
} from "./refund-rules"

/**
 * Účet pro vrácení peněz (11. 10. 2026) — čistá logika bez kontejneru.
 *
 * ## Proč
 *
 * Kartou placená objednávka se vrací sama: „Vrátit peníze" pošle refundaci
 * přes ComGate na tutéž kartu. Dobírka a placení při osobním odběru ale
 * nemají kam „couvnout" — peníze musí majitelka poslat převodem, a do 11. 10.
 * nikde nebylo číslo účtu (musela by o něj zákazníka psát a čekat). Proto ho
 * formulář reklamace / vrácení / odstoupení u takové objednávky chce rovnou
 * a admin ho ukáže u ručního vrácení.
 *
 * ## Co se přijímá
 *
 * - české číslo `[předčíslí-]číslo/kód banky` (např. `19-2000145399/0800`)
 *   s kontrolou modulo 11 (vyhláška ČNB č. 169/2011 Sb.) — překlep v číslici
 *   se chytí hned ve formuláři, ne až vrácenou platbou;
 * - IBAN (i slovenský apod.) s kontrolou modulo 97.
 *
 * Ukládá se normalizovaný zápis (`display`); IBAN se z něj dopočítá při
 * čtení (`parseRefundAccount` je idempotentní).
 */

export type RefundAccount = {
  /** Jak se účet ukládá a ukazuje: `19-2000145399/0800`, nebo IBAN po čtveřicích. */
  display: string
  /** IBAN bez mezer — pro bankovní aplikaci. */
  iban: string
}

export type RefundAccountVerdict =
  | { ok: true; account: RefundAccount }
  | { ok: false; message: string }

export const REFUND_ACCOUNT_INVALID =
  "Číslo účtu nevypadá správně — zadejte ho prosím jako 123456789/0800 (případně s předčíslím 19-123456789/0800), nebo jako IBAN."
export const REFUND_ACCOUNT_CHECKSUM =
  "Číslo účtu nesedí (kontrolní součet) — zkontrolujte prosím překlep v číslicích."
export const REFUND_ACCOUNT_REQUIRED =
  "Objednávku jste neplatili online přes ComGate, takže peníze vracíme převodem — vyplňte prosím číslo účtu."

const PREFIX_WEIGHTS = [10, 5, 8, 4, 2, 1]
const NUMBER_WEIGHTS = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1]

const mod11Ok = (digits: string, weights: number[]): boolean => {
  const padded = digits.padStart(weights.length, "0")
  const sum = weights.reduce((acc, weight, index) => acc + weight * Number(padded[index]), 0)
  return sum % 11 === 0
}

/** Zbytek po dělení 97 pro libovolně dlouhý řetězec číslic. */
const mod97 = (numeric: string): number => {
  let remainder = 0
  for (const char of numeric) {
    remainder = (remainder * 10 + Number(char)) % 97
  }
  return remainder
}

/** Písmena IBANu na čísla (A=10 … Z=35). */
const ibanToNumeric = (value: string): string =>
  value.replace(/[A-Z]/g, (char) => String(char.charCodeAt(0) - 55))

const ibanIsValid = (iban: string): boolean => {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  return mod97(ibanToNumeric(rearranged)) === 1
}

/** IBAN po čtveřicích: `CZ65 0800 0000 1920 0014 5399`. */
export const formatIban = (iban: string): string => iban.replace(/(.{4})/g, "$1 ").trim()

/** Český účet → IBAN (`CZkk` + kód banky 4 + předčíslí 6 + číslo 10). */
export const czechIban = (prefix: string, number: string, bank: string): string => {
  const bban = `${bank.padStart(4, "0")}${prefix.padStart(6, "0")}${number.padStart(10, "0")}`
  const check = 98 - mod97(ibanToNumeric(`${bban}CZ00`))
  return `CZ${String(check).padStart(2, "0")}${bban}`
}

const czechDisplay = (prefix: string, number: string, bank: string): string => {
  const cleanPrefix = prefix.replace(/^0+/, "")
  const cleanNumber = number.replace(/^0+/, "")
  return `${cleanPrefix ? `${cleanPrefix}-` : ""}${cleanNumber}/${bank}`
}

const CZECH_PATTERN = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/

/**
 * Přečte účet od zákazníka (nebo z uložené žádosti). Prázdný vstup → null
 * (volající rozhodne, zda je povinný); jinak verdikt s normalizovaným účtem.
 */
export const parseRefundAccount = (raw: unknown): RefundAccountVerdict | null => {
  if (typeof raw !== "string") return null
  const compact = raw.replace(/\s+/g, "").toUpperCase()
  if (!compact) return null

  const czech = CZECH_PATTERN.exec(compact)
  if (czech) {
    const prefix = czech[1] ?? ""
    const number = czech[2]
    const bank = czech[3]
    if (!/[1-9]/.test(number)) {
      return { ok: false, message: REFUND_ACCOUNT_INVALID }
    }
    if ((prefix && !mod11Ok(prefix, PREFIX_WEIGHTS)) || !mod11Ok(number, NUMBER_WEIGHTS)) {
      return { ok: false, message: REFUND_ACCOUNT_CHECKSUM }
    }
    return {
      ok: true,
      account: { display: czechDisplay(prefix, number, bank), iban: czechIban(prefix, number, bank) },
    }
  }

  if (/^[A-Z]{2}\d{2}/.test(compact)) {
    if (!ibanIsValid(compact)) {
      return { ok: false, message: REFUND_ACCOUNT_CHECKSUM }
    }
    // Český IBAN se ukazuje i domácím zápisem — tak ho majitelka zná z banky.
    if (compact.startsWith("CZ") && compact.length === 24) {
      const bank = compact.slice(4, 8)
      const prefix = compact.slice(8, 14)
      const number = compact.slice(14)
      return { ok: true, account: { display: czechDisplay(prefix, number, bank), iban: compact } }
    }
    return { ok: true, account: { display: formatIban(compact), iban: compact } }
  }

  return { ok: false, message: REFUND_ACCOUNT_INVALID }
}

/** Uložený účet → `{ display, iban }`, nebo null (chybí / nedá se přečíst). */
export const storedRefundAccount = (value: unknown): RefundAccount | null => {
  const verdict = parseRefundAccount(value)
  return verdict && verdict.ok ? verdict.account : null
}

type AccountPayment = {
  provider_id?: string | null
  captured_at?: unknown
  canceled_at?: unknown
}

type AccountOrder = MoneyOrder & {
  payment_collections?: Array<{ payments?: AccountPayment[] | null } | null> | null
  fulfillments?: Array<{ shipped_at?: unknown; canceled_at?: unknown } | null> | null
}

export const COMGATE_PROVIDER_ID = "pp_comgate_comgate"

/**
 * Chce formulář číslo účtu? Ano, když se peníze NEDAJÍ vrátit na kartu:
 * objednávka má platbu jinou než ComGate (dobírka, osobní odběr — i jen
 * autorizovanou, dobírka se zachytí až po doručení), nebo nemá žádnou
 * kartovou. Ne u objednávky, která nic nezaplatila a nic neodeslala — tu
 * odstoupení rovnou zruší (§13.1) a vracet se nemá co.
 */
export const refundAccountNeeded = (order: AccountOrder): boolean => {
  const payments = (order.payment_collections ?? [])
    .flatMap((collection) => collection?.payments ?? [])
    .filter((payment) => payment && !payment.canceled_at) as AccountPayment[]
  const hasCard = payments.some((payment) => payment.provider_id === COMGATE_PROVIDER_ID)
  const hasOther = payments.some((payment) => payment.provider_id !== COMGATE_PROVIDER_ID)
  if (hasCard && !hasOther) return false

  const shipped = (order.fulfillments ?? []).some(
    (fulfillment) => fulfillment?.shipped_at && !fulfillment?.canceled_at
  )
  return capturedTotal(order) > MONEY_EPSILON || shipped
}

/**
 * Musí zákazník účet vyplnit u téhle žádosti? Odstoupení a vrácení vždy
 * (peníze se vrací), reklamace jen s požadavkem „vrácení peněz" — u opravy či
 * výměny je účet nepovinný (hodí se, kdyby oprava nešla).
 */
export const refundAccountRequiredFor = (
  kind: string | null | undefined,
  requestedResolution: string | null | undefined
): boolean =>
  kind === "odstoupeni" || kind === "vraceni" || (kind === "reklamace" && requestedResolution === "refund")
