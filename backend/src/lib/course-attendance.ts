import { toAmount } from "../modules/course/pricing"

/**
 * Prezenční listina termínu kurzu a „Napsat všem účastníkům" — čistá logika.
 *
 * Bez importu frameworku: stejný soubor čte admin (tisk z detailu termínu),
 * backend (PDF do e-mailu majitelce, rozeslání zprávy) i testy. Tisk
 * v adminu, PDF i počet adresátů v okně zprávy tak počítají totéž.
 */

/** Rezervace tak, jak ji vrací admin API (`serializeAdminReservation`) i model. */
export type AttendanceReservation = {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  party_size?: unknown
  total_price?: unknown
  paid_amount?: unknown
  amount_due?: unknown
  payment_method?: string | null
  payment_status?: string | null
  status?: string | null
  note?: string | null
  /** Schválená žádost o místo — zákazník si platbu ještě nevybral. */
  payment_choice_pending?: boolean | null
}

export type AttendanceRow = {
  id: string
  name: string
  phone: string
  email: string
  party_size: number
  /** Kolik je u nás zaplaceno (Kč). */
  paid: number
  /** Kolik se má vybrat na místě (Kč), 0 = nic. */
  due: number
  /** Krátce slovy: „zaplaceno kartou", „platí na místě", „čeká na platbu kartou". */
  payment_note: string
  note: string
}

export type AttendanceSummary = {
  reservations: number
  people: number
  /** Celkem vybrat na místě (Kč). */
  due_total: number
  /** Rezervace bez e-mailu — zprávu všem nedostanou. */
  without_email: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** Platná rezervace = nezrušená. Zrušené na listinu ani do zprávy nepatří. */
export const isActiveReservation = (reservation: AttendanceReservation): boolean =>
  reservation.status !== "cancelled"

/**
 * Zaplaceno a zbývá vybrat — z evidence peněz (`lib/course-money`). Starší
 * řádky bez evidence (zaplacené dřív, než sloupec vznikl) mají `paid_amount`
 * 0 — u nich platí „zaplaceno = cena".
 */
export const reservationMoney = (
  reservation: AttendanceReservation
): { paid: number; due: number } => {
  const total = toAmount(reservation.total_price)
  const recorded = toAmount(reservation.paid_amount)
  const paid =
    recorded > 0 ? recorded : reservation.payment_status === "paid" ? total : 0
  return { paid: round2(paid), due: round2(Math.max(0, total - paid)) }
}

const paymentNoteOf = (reservation: AttendanceReservation, due: number): string => {
  if (reservation.payment_choice_pending && reservation.payment_status !== "paid") {
    return "ještě nevybral(a) platbu"
  }
  if (reservation.payment_status === "paid") {
    if (due > 0) return "doplatit rozdíl"
    return reservation.payment_method === "online" ? "zaplaceno kartou" : "zaplaceno na místě"
  }
  if (reservation.payment_method === "online") return "čeká na platbu kartou"
  return "platí na místě"
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

/** Řádky prezenční listiny: jen platné rezervace, podle jména (česky). */
export const attendanceRows = (reservations: AttendanceReservation[]): AttendanceRow[] =>
  reservations
    .filter(isActiveReservation)
    .map((reservation) => {
      const { paid, due } = reservationMoney(reservation)
      return {
        id: reservation.id,
        name: text(reservation.name) || "—",
        phone: text(reservation.phone),
        email: text(reservation.email),
        party_size: Math.max(1, Math.trunc(toAmount(reservation.party_size)) || 1),
        paid,
        due,
        payment_note: paymentNoteOf(reservation, due),
        note: text(reservation.note),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, "cs"))

export const attendanceSummary = (rows: AttendanceRow[]): AttendanceSummary => ({
  reservations: rows.length,
  people: rows.reduce((sum, row) => sum + row.party_size, 0),
  due_total: round2(rows.reduce((sum, row) => sum + row.due, 0)),
  without_email: rows.filter((row) => !row.email).length,
})

/* ------------------------------------------------------------------------- */
/* Prezenční listina e-mailem 12 h před začátkem                              */
/* ------------------------------------------------------------------------- */

export const ATTENDANCE_SHEET_LEAD_HOURS = 12

export type AttendanceTermCandidate = {
  id: string
  starts_at: unknown
  status?: string | null
  reservations?: AttendanceReservation[] | null
}

/**
 * Klíč oznámení majitelce. Začátek termínu je v klíči schválně: když se
 * termín po odeslání přesune na jiný čas, listina k novému času přijde znovu.
 * Druhý díl (`course-attendance`) je zároveň `trigger_type` oznámení.
 */
export const attendanceSheetKey = (term: { id: string; starts_at: unknown }): string => {
  const starts = new Date(term.starts_at as string)
  const stamp = Number.isNaN(starts.getTime()) ? "x" : starts.toISOString()
  return `mn:course-attendance:${term.id}:${stamp}`
}

/** Okno dotazu jobu: od teď do teď + 12 h. */
export const attendanceSheetWindow = (now: Date): { from: Date; to: Date } => ({
  from: now,
  to: new Date(now.getTime() + ATTENDANCE_SHEET_LEAD_HOURS * 60 * 60 * 1000),
})

/**
 * Které termíny dostanou listinu teď: začínají za 0–12 h, nejsou zrušené
 * ani skončené, mají aspoň jednu platnou rezervaci a jejich klíč ještě
 * neodešel (`sentKeys`). Koncept s ručními rezervacemi se počítá — lidé
 * přijdou, i když termín na webu není vidět.
 */
export const termsDueForAttendanceSheet = <T extends AttendanceTermCandidate>(
  terms: T[],
  now: Date,
  sentKeys: ReadonlySet<string> = new Set()
): T[] => {
  const { from, to } = attendanceSheetWindow(now)
  return terms.filter((term) => {
    if (term.status === "cancelled" || term.status === "finished") return false
    const starts = new Date(term.starts_at as string).getTime()
    if (Number.isNaN(starts) || starts <= from.getTime() || starts > to.getTime()) {
      return false
    }
    if (!(term.reservations ?? []).some(isActiveReservation)) return false
    return !sentKeys.has(attendanceSheetKey(term))
  })
}

/* ------------------------------------------------------------------------- */
/* Napsat všem účastníkům                                                     */
/* ------------------------------------------------------------------------- */

export type MessageRecipient = { reservation_id: string; name: string; email: string }

/**
 * Komu zpráva odejde: platné rezervace s e-mailem, každá adresa jednou
 * (dvě rezervace jednoho člověka = jeden e-mail). Kdo e-mail nemá, je
 * v `withoutEmail` — těm je potřeba zavolat.
 */
export const messageRecipients = (
  reservations: AttendanceReservation[]
): { recipients: MessageRecipient[]; withoutEmail: Array<{ name: string; phone: string }> } => {
  const recipients: MessageRecipient[] = []
  const withoutEmail: Array<{ name: string; phone: string }> = []
  const seen = new Set<string>()
  for (const reservation of reservations.filter(isActiveReservation)) {
    const email = text(reservation.email)
    const name = text(reservation.name) || "—"
    if (!email) {
      withoutEmail.push({ name, phone: text(reservation.phone) })
      continue
    }
    const normalized = email.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    recipients.push({ reservation_id: reservation.id, name, email })
  }
  return { recipients, withoutEmail }
}

/** Klíč jednoho e-mailu zprávy — dvojklik (stejný `batchKey`) nepošle nic dvakrát. */
export const courseMessageKey = (batchKey: string, reservationId: string): string =>
  `course-message:${batchKey}:${reservationId}`

/** Klíč dávky od klienta: krátký, bez dvojteček (ty dělí klíč notifikace). */
export const isValidBatchKey = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value)

/**
 * „1 800 Kč" s obyčejnými mezerami — pevná mezera z `Intl` (U+00A0/U+202F)
 * nemusí být ve fontu PDF a v tisku nic nepřidá.
 */
export const formatKc = (value: number): string =>
  `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 })
    .format(round2(value))
    .replace(/[  ]/g, " ")} Kč`

export const persons = (count: number): string =>
  count === 1 ? "1 osoba" : count >= 2 && count <= 4 ? `${count} osoby` : `${count} osob`
