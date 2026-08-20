import {
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import type { Context } from "@medusajs/framework/types"
import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import { CourseReservation } from "./models/course-reservation"
import { CourseTerm } from "./models/course-term"
import { CourseWaitlist } from "./models/course-waitlist"
import { canCustomerEditParty } from "./lifecycle"
import { fitsCapacity, quoteFor, toAmount } from "./pricing"

export type ReserveSeatsInput = {
  term_id: string
  name: string
  email?: string | null
  phone?: string | null
  party_size: number
  payment_method: "online" | "on_site"
  source: "web" | "manual"
  customer_id?: string | null
  note?: string | null
}

export default class CourseModuleService extends MedusaService({
  CourseTerm,
  CourseReservation,
  CourseWaitlist,
}) {
  /**
   * Creates a reservation with the capacity check done *inside* the
   * transaction, against a `FOR UPDATE` lock on the term row.
   *
   * Two people racing for the last seats is the whole reason this method
   * exists: without the lock, both would read „2 volná místa", both would
   * pass the check, and the term would end up overbooked. With it, the second
   * transaction waits on the first and then honestly sees the term full.
   *
   * The price is also computed here, from the locked term row — never from
   * anything a client sent.
   */
  @InjectTransactionManager()
  async reserveSeats(
    input: ReserveSeatsInput,
    @MedusaContext() context: Context<EntityManager> = {}
  ): Promise<{ reservation: any; term: any }> {
    const manager = context.transactionManager!

    const partySize = Math.trunc(Number(input.party_size))
    if (!Number.isInteger(partySize) || partySize < 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Počet osob musí být alespoň 1."
      )
    }

    const [term] = (await manager.execute(
      `select * from "course_term" where "id" = ? and "deleted_at" is null for update`,
      [input.term_id]
    )) as any[]

    if (!term) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Termín kurzu nebyl nalezen."
      )
    }

    if (input.source === "web") {
      // The public flow books only published, future terms. Manual entries are
      // looser — the owner may pencil in a phone booking on a draft term — but
      // nobody books a cancelled or finished one.
      if (term.status !== "published") {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Tento termín už není možné rezervovat."
        )
      }
      if (new Date(term.starts_at).getTime() <= Date.now()) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Tento termín už proběhl nebo právě začíná."
        )
      }
    } else if (["cancelled", "finished"].includes(term.status)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Na zrušený nebo proběhlý termín nelze přidat rezervaci."
      )
    }

    const [row] = (await manager.execute(
      `select coalesce(sum("party_size"), 0) as taken
         from "course_reservation"
        where "term_id" = ? and "status" != 'cancelled' and "deleted_at" is null`,
      [input.term_id]
    )) as any[]
    const taken = Math.trunc(toAmount(row?.taken))

    if (!fitsCapacity(term.capacity, taken, partySize)) {
      const left = Math.max(0, Math.trunc(toAmount(term.capacity)) - taken)
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        left > 0
          ? `Na tento termín zbývá už jen ${left} ${left === 1 ? "místo" : left < 5 ? "místa" : "míst"}.`
          : "Tento termín je už plně obsazený."
      )
    }

    const quote = quoteFor(partySize, term)

    // Stored lowercased so the account page („Kurzy" v účtu) can match guest
    // bookings against the account's e-mail with a plain equality filter.
    const email = input.email?.trim().toLowerCase() || null

    const reservation = await this.createCourseReservations(
      {
        term_id: input.term_id,
        customer_id: input.customer_id || null,
        name: input.name,
        email,
        phone: input.phone || null,
        party_size: partySize,
        pricing_tier: quote.tier,
        total_price: quote.total,
        payment_method: input.payment_method,
        payment_status:
          input.payment_method === "online" ? "pending" : "on_site",
        status: "active",
        source: input.source,
        note: input.note || null,
      } as never,
      context
    )

    return { reservation, term }
  }

  /**
   * Changes the party size of one reservation with the capacity check done
   * *inside* the transaction, against the same `FOR UPDATE` lock on the term
   * row that `reserveSeats` takes.
   *
   * The lock matters for the same race: a customer growing their party from 2
   * to 4 while someone else books the last seats must not overbook the term.
   * Seats are recounted under the lock **excluding this reservation** (its
   * old size is being replaced, not added to), and the price is recomputed
   * from the locked term row — never from anything a client sent.
   *
   * A pending online payment link carries the OLD amount, so when one exists
   * it is cleared in the same update: the next „Zaplatit" mints a fresh
   * collection and session at the new price instead of charging the stale
   * total. Whether the customer is *allowed* to edit (48h cutoff, not paid
   * online) is the route's question — this method only guarantees that
   * whatever lands, lands consistently.
   */
  @InjectTransactionManager()
  async updateReservationPartySize(
    input: { reservation_id: string; party_size: number },
    @MedusaContext() context: Context<EntityManager> = {}
  ): Promise<{ reservation: any; term: any }> {
    const manager = context.transactionManager!

    const partySize = Math.trunc(Number(input.party_size))
    if (!Number.isInteger(partySize) || partySize < 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Počet osob musí být alespoň 1."
      )
    }

    const [found] = (await manager.execute(
      `select * from "course_reservation" where "id" = ? and "deleted_at" is null`,
      [input.reservation_id]
    )) as any[]

    if (!found) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Rezervace nebyla nalezena."
      )
    }
    if (found.status !== "active") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Zrušenou rezervaci už nelze upravit."
      )
    }

    const [term] = (await manager.execute(
      `select * from "course_term" where "id" = ? and "deleted_at" is null for update`,
      [found.term_id]
    )) as any[]

    if (!term) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Termín kurzu nebyl nalezen."
      )
    }
    if (term.status !== "published") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Tento termín už není možné upravit."
      )
    }
    if (new Date(term.starts_at).getTime() <= Date.now()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Tento termín už proběhl nebo právě začíná."
      )
    }

    // Re-read the reservation row under its own lock, now that the term lock
    // serializes us against other bookings. The route checked eligibility
    // before entering this transaction — but the ComGate subscriber may have
    // stamped `paid_at` in the window between that check and this lock (the
    // exact race the expiry job guards against with its conditional UPDATE).
    // Deciding on the locked row means a payment that won the race is *seen*:
    // the edit refuses instead of detaching a captured amount from its price.
    const [reservation] = (await manager.execute(
      `select * from "course_reservation" where "id" = ? and "deleted_at" is null for update`,
      [input.reservation_id]
    )) as any[]

    if (!reservation || reservation.status !== "active") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Zrušenou rezervaci už nelze upravit."
      )
    }
    if (!canCustomerEditParty(reservation)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Zaplacenou rezervaci upravíte zrušením (peníze vrátíme na kartu) a novou rezervací — nebo mi zavolejte."
      )
    }

    const [row] = (await manager.execute(
      `select coalesce(sum("party_size"), 0) as taken
         from "course_reservation"
        where "term_id" = ? and "status" != 'cancelled' and "deleted_at" is null
          and "id" != ?`,
      [reservation.term_id, reservation.id]
    )) as any[]
    const takenByOthers = Math.trunc(toAmount(row?.taken))

    if (!fitsCapacity(term.capacity, takenByOthers, partySize)) {
      const left = Math.max(
        0,
        Math.trunc(toAmount(term.capacity)) - takenByOthers
      )
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        left > 0
          ? `Na tento termín zbývá už jen ${left} ${left === 1 ? "místo" : left < 5 ? "místa" : "míst"}.`
          : "Tento termín je už plně obsazený."
      )
    }

    const quote = quoteFor(partySize, term)

    const resetPaymentLink =
      reservation.payment_method === "online" &&
      reservation.payment_status === "pending" &&
      !reservation.paid_at

    const updated = await this.updateCourseReservations(
      {
        id: reservation.id,
        party_size: partySize,
        pricing_tier: quote.tier,
        total_price: quote.total,
        ...(resetPaymentLink
          ? {
              payment_collection_id: null,
              payment_session_id: null,
              payment_url: null,
            }
          : {}),
      } as never,
      context
    )

    return { reservation: updated, term }
  }

  /**
   * Cancels one reservation on the customer's behalf — atomically.
   *
   * A single conditional UPDATE, for two races the cancel route cannot see
   * from a pre-read:
   *
   * - two tabs cancelling at once: the WHERE re-checks `status = 'active'`
   *   under the row lock, so exactly one request performs the cancel (and
   *   attempts the refund); the loser matches zero rows and is told the
   *   reservation is already cancelled.
   * - a ComGate capture landing in the same instant: `returning *` hands back
   *   the row as it was the moment the cancel committed, so the route decides
   *   the money story (refund vs. „nothing was paid") from payment fields no
   *   older than the cancel itself. A capture that commits *after* this
   *   update is seen by the payment subscriber's own status re-read and goes
   *   down its loud manual-refund path.
   *
   * The literal 'customer' matches `lifecycle.ts#CUSTOMER_CANCEL_REASON` and
   * the check constraint of `Migration20260820110000` — keep them in sync.
   *
   * Returns the cancelled row, or `null` when the reservation was not active
   * (already cancelled, or never existed).
   */
  @InjectTransactionManager()
  async cancelReservationByCustomer(
    reservationId: string,
    @MedusaContext() context: Context<EntityManager> = {}
  ): Promise<any | null> {
    const manager = context.transactionManager!
    const rows = (await manager.execute(
      `update "course_reservation"
          set "status" = 'cancelled',
              "cancelled_at" = now(),
              "cancel_reason" = 'customer',
              "updated_at" = now()
        where "id" = ?
          and "deleted_at" is null
          and "status" = 'active'
        returning *`,
      [reservationId]
    )) as any[]
    return rows[0] ?? null
  }

  /**
   * Cancels one unpaid online reservation — atomically.
   *
   * The 24h expiry job must never cancel a reservation whose payment just
   * landed, and a pre-read cannot guarantee that: the ComGate subscriber may
   * stamp `paid_at` in the milliseconds between the job's read and its write.
   * This is therefore a single conditional UPDATE — the WHERE re-checks
   * „online, still pending, unpaid, active, old enough" on the current row
   * version under the row lock, so a payment that wins the race makes the
   * update match zero rows instead of cancelling money.
   *
   * Returns whether the reservation was actually expired. The conditions
   * mirror `lifecycle.ts#shouldAutoExpire` — keep the two in sync.
   */
  @InjectTransactionManager()
  async expireUnpaidReservation(
    reservationId: string,
    cutoff: Date,
    @MedusaContext() context: Context<EntityManager> = {}
  ): Promise<boolean> {
    const manager = context.transactionManager!
    const rows = (await manager.execute(
      `update "course_reservation"
          set "status" = 'cancelled',
              "cancelled_at" = now(),
              "cancel_reason" = 'auto_expired',
              "updated_at" = now()
        where "id" = ?
          and "deleted_at" is null
          and "status" = 'active'
          and "payment_method" = 'online'
          and "payment_status" = 'pending'
          and "paid_at" is null
          and "created_at" <= ?
        returning "id"`,
      [reservationId, cutoff]
    )) as any[]
    return rows.length > 0
  }
}
