import { toAmount } from "./pricing"

/**
 * The course system's *time and eligibility* arithmetic, dependency-free like
 * `./pricing.ts` and for the same reason: every scheduled job (auto-expiry,
 * reminders, auto-finish) and both cancel routes decide who is affected
 * through these functions, so the decisions are testable without a container
 * and cannot drift apart between the job and the route that shares its rule.
 *
 * Anything that talks to the database, the payment module or the mailer lives
 * in `lib/course-*.ts` — this file only answers yes/no/when questions.
 */

/* ------------------------------------------------------------------------- */
/* Idempotency keys                                                          */
/* ------------------------------------------------------------------------- */

/**
 * Notification dedupe keys, built in one place so the senders and the tests
 * agree letter for letter. `createNotifications` skips a key it has already
 * delivered, which is what makes every job below safe to re-run.
 */
export const courseExpiredKey = (reservationId: string): string =>
  `course-expired:${reservationId}`

export const courseCancelledKey = (reservationId: string): string =>
  `course-cancelled:${reservationId}`

export const courseReminderKey = (reservationId: string): string =>
  `course-reminder:${reservationId}`

export const courseReminderCallListKey = (termId: string): string =>
  `course-reminder-calllist:${termId}`

export const courseWaitlistKey = (entryId: string): string =>
  `course-waitlist:${entryId}`

/**
 * The re-sent confirmation after a customer edits their party size. The new
 * size is part of the key on purpose: `course-confirm:on_site:{id}` was
 * already delivered once and would be deduped forever, while this key changes
 * with every *different* size — so a repeat edit re-sends the confirmation
 * with the new numbers, and a retried request for the same size stays one
 * e-mail.
 */
export const courseConfirmUpdatedKey = (
  reservationId: string,
  partySize: number
): string => `course-confirm:updated:${reservationId}:${partySize}`

/* ------------------------------------------------------------------------- */
/* Auto-expiry of unpaid online reservations (24 hours)                      */
/* ------------------------------------------------------------------------- */

export const COURSE_EXPIRY_HOURS = 24

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** Reservations created before this moment have had their 24 hours. */
export const expiryCutoff = (now: Date): Date =>
  new Date(now.getTime() - COURSE_EXPIRY_HOURS * HOUR_MS)

export type ExpiryCandidate = {
  payment_method?: string | null
  payment_status?: string | null
  status?: string | null
  paid_at?: unknown
  created_at?: unknown
}

/**
 * Whether the hourly job may cancel this reservation.
 *
 * Deliberately strict on every axis: only online bookings (pay-on-site rows
 * owe nothing), only still-active ones, only genuinely unpaid ones — a
 * `paid_at` OR a `paid` status counts as paid, because the subscriber sets
 * both and this check must err on the side of not cancelling money. The job
 * re-reads the row and re-asks this question right before cancelling, so a
 * payment captured between the query and the cancel wins the race.
 */
export const shouldAutoExpire = (
  reservation: ExpiryCandidate,
  now: Date
): boolean => {
  if (reservation.payment_method !== "online") {
    return false
  }
  if (reservation.status !== "active") {
    return false
  }
  if (reservation.payment_status === "paid" || reservation.paid_at) {
    return false
  }
  const created = new Date(reservation.created_at as string)
  if (Number.isNaN(created.getTime())) {
    return false
  }
  return created.getTime() <= expiryCutoff(now).getTime()
}

/* ------------------------------------------------------------------------- */
/* Customer self-service (cancel & party-size edit) — the 48h cutoff         */
/* ------------------------------------------------------------------------- */

/**
 * How close to the course start a customer may still cancel or edit their own
 * reservation. Inside the window the owner has already planned material and
 * seats around the headcount, so changes go through a phone call instead —
 * the routes refuse with `COURSE_SELF_SERVICE_TOO_LATE`.
 */
export const COURSE_SELF_SERVICE_CUTOFF_HOURS = 48

export const COURSE_SELF_SERVICE_TOO_LATE =
  "Do kurzu zbývá méně než 48 hodin — zavolejte mi prosím."

/** The customer's own cancel files under this reason (admin: „zrušil zákazník"). */
export const CUSTOMER_CANCEL_REASON = "customer" as const

/** The last moment self-service is allowed: start minus 48 hours. */
export const selfServiceDeadline = (startsAt: unknown): Date | null => {
  const starts = new Date(startsAt as string)
  if (Number.isNaN(starts.getTime())) {
    return null
  }
  return new Date(
    starts.getTime() - COURSE_SELF_SERVICE_CUTOFF_HOURS * HOUR_MS
  )
}

/**
 * Whether the customer may still act on this term at all. An unparsable
 * start refuses — better to ask for a phone call than to allow a cancel on a
 * term whose date we cannot read.
 */
export const isBeforeSelfServiceCutoff = (
  startsAt: unknown,
  now: Date
): boolean => {
  const deadline = selfServiceDeadline(startsAt)
  return deadline != null && now.getTime() < deadline.getTime()
}

export type EditCandidate = {
  status?: string | null
  payment_method?: string | null
  payment_status?: string | null
  paid_at?: unknown
}

/**
 * Whether the customer may change the party size themselves: only while no
 * online payment has landed. A paid card payment fixes the amount — changing
 * seats under it would detach the money from the price, so paid reservations
 * go through cancel (auto-refund) + re-book instead. `paid_at` OR a `paid`
 * status counts as paid, same belt-and-braces as `shouldAutoExpire`.
 */
export const canCustomerEditParty = (reservation: EditCandidate): boolean => {
  if (reservation.status !== "active") {
    return false
  }
  if (reservation.payment_method === "on_site") {
    return true
  }
  return (
    reservation.payment_method === "online" &&
    reservation.payment_status !== "paid" &&
    !reservation.paid_at
  )
}

/* ------------------------------------------------------------------------- */
/* Reminder window (3 days before the course)                                */
/* ------------------------------------------------------------------------- */

/**
 * The reminder goes out once, roughly three days ahead. The window spans
 * now+1d … now+3d — deliberately TWO days wide for a band that advances one
 * day per daily run: a 24h-wide band has zero slack, so a run that fires
 * late or not at all (deploy, restart, DST) would permanently miss the terms
 * passing through it that morning. Two days wide means every term sits in
 * the band on two consecutive mornings; the per-reservation dedupe key turns
 * the second sighting into a no-op, so the extra morning only ever matters
 * when the first one failed.
 */
export const reminderWindow = (now: Date): { from: Date; to: Date } => ({
  from: new Date(now.getTime() + 1 * DAY_MS),
  to: new Date(now.getTime() + 3 * DAY_MS),
})

export const isInReminderWindow = (
  startsAt: unknown,
  now: Date
): boolean => {
  const starts = new Date(startsAt as string)
  if (Number.isNaN(starts.getTime())) {
    return false
  }
  const { from, to } = reminderWindow(now)
  return starts.getTime() >= from.getTime() && starts.getTime() <= to.getTime()
}

/* ------------------------------------------------------------------------- */
/* Auto-finish of past published terms                                       */
/* ------------------------------------------------------------------------- */

export type TermSchedule = {
  starts_at?: unknown
  duration_minutes?: unknown
}

/**
 * When the term is over: start plus duration when one is set, otherwise the
 * start alone. Without the duration fallback a 10:00 course would flip to
 * „proběhlý" while people are still at the wheel — with it, a term with no
 * duration is treated as over the moment it began, which is the best honest
 * answer the data allows.
 */
export const termEndsAt = (term: TermSchedule): Date | null => {
  const starts = new Date(term.starts_at as string)
  if (Number.isNaN(starts.getTime())) {
    return null
  }
  const minutes = Math.trunc(toAmount(term.duration_minutes))
  return minutes > 0 ? new Date(starts.getTime() + minutes * 60 * 1000) : starts
}

export const hasTermEnded = (term: TermSchedule, now: Date): boolean => {
  const end = termEndsAt(term)
  return end != null && end.getTime() <= now.getTime()
}

/* ------------------------------------------------------------------------- */
/* Refund eligibility                                                        */
/* ------------------------------------------------------------------------- */

export type RefundCandidate = {
  payment_method?: string | null
  payment_status?: string | null
  payment_collection_id?: string | null
  refunded_at?: unknown
}

/**
 * Whether a cancellation should even *try* the automatic ComGate refund.
 * `refunded_at` is the never-twice guard: once stamped, every retry of the
 * cancel route and every re-run of a term cancel walks past this reservation.
 */
export const canAttemptCourseRefund = (
  reservation: RefundCandidate
): boolean =>
  reservation.payment_method === "online" &&
  reservation.payment_status === "paid" &&
  Boolean(reservation.payment_collection_id) &&
  !reservation.refunded_at

export type RefundablePayment = {
  id?: string
  provider_id?: string | null
  amount?: unknown
  captured_at?: unknown
  canceled_at?: unknown
}

/**
 * The one payment worth refunding in a course payment collection: ComGate,
 * captured, not cancelled. Course collections are created per reservation, so
 * there is at most one — but the filter still refuses to hand back an
 * uncaptured or foreign-provider row rather than trusting the count.
 */
export const pickRefundablePayment = (
  payments: RefundablePayment[],
  comgateProviderId: string
): RefundablePayment | null =>
  payments.find(
    (payment) =>
      payment?.provider_id === comgateProviderId &&
      Boolean(payment?.captured_at) &&
      !payment?.canceled_at
  ) ?? null

/**
 * Runs one refund attempt per reservation, isolating failures: reservation
 * three's dead payment must not stop reservations four through nine getting
 * their money. Sequential on purpose — parallel refunds against one payment
 * provider gain nothing and make the logs unreadable.
 */
export const refundSequentially = async <T extends { id: string }>(
  reservations: T[],
  refundOne: (reservation: T) => Promise<boolean>
): Promise<{ refunded: T[]; failed: T[] }> => {
  const refunded: T[] = []
  const failed: T[] = []
  for (const reservation of reservations) {
    try {
      if (await refundOne(reservation)) {
        refunded.push(reservation)
      } else {
        failed.push(reservation)
      }
    } catch {
      failed.push(reservation)
    }
  }
  return { refunded, failed }
}

/* ------------------------------------------------------------------------- */
/* Waitlist                                                                  */
/* ------------------------------------------------------------------------- */

export type WaitlistEntry = {
  id?: string
  party_size?: unknown
  notified_at?: unknown
  created_at?: unknown
}

/**
 * Who to tell that seats came free: entries not yet notified, oldest first,
 * and only those whose whole party fits into the seats free *right now*.
 *
 * Every fitting entry is notified — not just the first — because the seats
 * are not held for anyone: the e-mail says so, and first-come-first-served
 * at the reservation form is the honest tiebreak. An entry larger than the
 * gap stays quiet (and un-notified) until enough seats open for all of them;
 * telling a party of four about two free chairs would only invite a phone
 * call the owner cannot say yes to.
 */
export const waitlistEntriesToNotify = <T extends WaitlistEntry>(
  entries: T[],
  seatsFree: number
): T[] => {
  if (!(seatsFree > 0)) {
    return []
  }
  return entries
    .filter((entry) => !entry.notified_at)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at as string).getTime() -
        new Date(b.created_at as string).getTime()
    )
    .filter((entry) => {
      const size = Math.trunc(toAmount(entry.party_size))
      return size >= 1 && size <= seatsFree
    })
}
