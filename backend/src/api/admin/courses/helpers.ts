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
  payment_method: reservation.payment_method,
  payment_status: reservation.payment_status,
  paid_at: reservation.paid_at ?? null,
  status: reservation.status,
  cancelled_at: reservation.cancelled_at ?? null,
  /** 'auto_expired' | 'manual' | 'term_cancelled' | 'customer' — the page says it in words. */
  cancel_reason: reservation.cancel_reason ?? null,
  /** Set once the automatic ComGate refund went through. */
  refunded_at: reservation.refunded_at ?? null,
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
