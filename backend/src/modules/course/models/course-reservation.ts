import { model } from "@medusajs/framework/utils"
import { CourseTerm } from "./course-term"

/**
 * One booking on a term — a web reservation (guest or logged-in customer) or
 * a manual entry the owner types in after a phone call.
 *
 * `total_price` is always computed server-side from the term's prices and the
 * party size (see `../pricing.ts`); it is never taken from a client. Payment
 * bookkeeping mirrors the made-to-order payment request: the ComGate session id
 * is what the `payment.captured` subscriber reconciles by.
 */
export const CourseReservation = model.define("course_reservation", {
  id: model.id().primaryKey(),
  term: model.belongsTo(() => CourseTerm, {
    mappedBy: "reservations",
  }),
  /** Set when the booker was logged in; guests and manual entries stay null. */
  customer_id: model.text().index().nullable(),
  name: model.text(),
  email: model.text().nullable(),
  phone: model.text().nullable(),
  party_size: model.number(),
  pricing_tier: model.enum(["single", "pair", "group"]),
  total_price: model.bigNumber(),
  payment_method: model.enum(["online", "on_site"]),
  payment_status: model
    .enum(["pending", "paid", "on_site"])
    .index()
    .default("pending"),
  paid_at: model.dateTime().nullable(),
  /** Cancelled reservations free their seats but keep their history. */
  status: model.enum(["active", "cancelled"]).index().default("active"),
  cancelled_at: model.dateTime().nullable(),
  /**
   * Why it was cancelled — the admin list says it in words: 'auto_expired'
   * (the 24h unpaid-online expiry job), 'manual' (the owner's own click),
   * 'term_cancelled' (went down with the whole term) or 'customer' (the
   * customer cancelled it themselves from the reservation page). Null on rows
   * cancelled before this column existed.
   */
  cancel_reason: model
    .enum(["auto_expired", "manual", "term_cancelled", "customer"])
    .nullable(),
  /** Stamped once the automatic ComGate refund succeeded — never refund twice. */
  refunded_at: model.dateTime().nullable(),
  source: model.enum(["web", "manual"]).default("web"),
  /** The owner's own note („zavolala paní Nováková, přijdou 3"). */
  note: model.text().nullable(),
  payment_collection_id: model.text().index().nullable(),
  payment_session_id: model.text().index().nullable(),
  provider_transaction_id: model.text().nullable(),
  payment_url: model.text().nullable(),
  /** iDoklad idempotency facts, stamped once the invoice exists. */
  idoklad_invoice_id: model.number().nullable(),
  idoklad_invoice_number: model.text().nullable(),
  idoklad_pdf_url: model.text().nullable(),
})
