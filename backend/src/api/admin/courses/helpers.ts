import { seatsLeft, seatsTaken, toAmount } from "../../../modules/course/pricing"

/**
 * Admin-facing shapes for terms and reservations — one place, so the list,
 * the create/patch responses and the cancel flows all say the same thing.
 */

export const serializeAdminReservation = (reservation: any) => ({
  id: reservation.id,
  name: reservation.name,
  email: reservation.email ?? null,
  phone: reservation.phone ?? null,
  party_size: Math.trunc(toAmount(reservation.party_size)),
  pricing_tier: reservation.pricing_tier,
  total_price: toAmount(reservation.total_price),
  /** Evidence peněz (lib/course-money): zaplaceno celkem a zbývá doplatit. */
  paid_amount: toAmount(reservation.paid_amount),
  amount_due: toAmount(reservation.amount_due),
  payment_method: reservation.payment_method,
  payment_status: reservation.payment_status,
  paid_at: reservation.paid_at ?? null,
  status: reservation.status,
  cancelled_at: reservation.cancelled_at ?? null,
  /** 'auto_expired' | 'manual' | 'term_cancelled' | 'customer' — the page says it in words. */
  cancel_reason: reservation.cancel_reason ?? null,
  /** Set once the automatic ComGate refund went through. */
  refunded_at: reservation.refunded_at ?? null,
  /* Doklad — řádek podle nich pozná, jestli je co vystavovat a kam odkázat. */
  idoklad_invoice_number: reservation.idoklad_invoice_number ?? null,
  idoklad_pdf_url: reservation.idoklad_pdf_url ?? null,
  /* Žádost o zrušení po uplynutí samoobslužné lhůty — fronta v administraci. */
  cancel_request_status: reservation.cancel_request_status ?? null,
  cancel_requested_at: reservation.cancel_requested_at ?? null,
  cancel_request_note: reservation.cancel_request_note ?? null,
  cancel_decided_at: reservation.cancel_decided_at ?? null,
  cancel_decision_note: reservation.cancel_decision_note ?? null,
  source: reservation.source,
  note: reservation.note ?? null,
  customer_id: reservation.customer_id ?? null,
  created_at: reservation.created_at,
})

/** One waitlist entry, oldest-first ordering is the caller's concern. */
export const serializeAdminWaitlistEntry = (entry: any) => ({
  id: entry.id,
  name: entry.name,
  email: entry.email ?? null,
  party_size: Math.trunc(toAmount(entry.party_size)),
  notified_at: entry.notified_at ?? null,
  created_at: entry.created_at,
})

export const serializeAdminTerm = (term: any) => {
  const reservations = (term.reservations ?? []) as any[]
  const waitlist = (term.waitlist ?? []) as any[]
  return {
    id: term.id,
    title: term.title,
    location: term.location,
    starts_at: term.starts_at,
    duration_minutes: term.duration_minutes ?? null,
    capacity: Math.trunc(toAmount(term.capacity)),
    seats_taken: seatsTaken(reservations),
    seats_left: seatsLeft(term.capacity, reservations),
    price_single: toAmount(term.price_single),
    price_two: term.price_two != null ? toAmount(term.price_two) : null,
    group_min: term.group_min != null ? Math.trunc(toAmount(term.group_min)) : null,
    price_group_per_person:
      term.price_group_per_person != null
        ? toAmount(term.price_group_per_person)
        : null,
    status: term.status,
    note: term.note ?? null,
    created_at: term.created_at,
    reservations: reservations
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map(serializeAdminReservation),
    /** FIFO — the same order the seat-freeing hook notifies in. */
    waitlist: waitlist
      .slice()
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .map(serializeAdminWaitlistEntry),
    /** Entries still waiting for their notification. */
    waitlist_waiting: waitlist.filter((entry) => !entry.notified_at).length,
  }
}
