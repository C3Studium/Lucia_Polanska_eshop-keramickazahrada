import { model } from "@medusajs/framework/utils"
import { CourseTerm } from "./course-term"
import { CoursePaymentRequest } from "./course-payment-request"

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
  /**
   * Kolik u nás zákazník má zaplaceno (prvotní platba + doplatky − vrácené).
   * Online rezervace: po zaplacení = cena; po změně počtu osob se drží
   * skutečnost, ne nová cena. Na místě: 0, dokud se nezaplatí na místě.
   */
  paid_amount: model.bigNumber().default(0),
  /**
   * Kolik zbývá zaplatit: cena − zaplaceno (nikdy záporné; přeplatek se
   * vrací a je v `course_payment_request` typu refund). Po přidání osob
   * u zaplacené rezervace = doplatek.
   */
  amount_due: model.bigNumber().default(0),
  /**
   * Rezervace vznikla schválením žádosti o místo nad kapacitu — zákazník si
   * ještě musí vybrat platbu (kartou / na místě) a potvrdit obchodní podmínky
   * na stránce rezervace (`POST …/confirm`). Pak se příznak smaže.
   */
  payment_choice_pending: model.boolean().default(false),
  payment_requests: model.hasMany(() => CoursePaymentRequest, {
    mappedBy: "reservation",
  }),
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
  /**
   * Žádost o zrušení, kterou podal zákazník po uplynutí samoobslužné lhůty
   * (do 24 h před začátkem se ruší samo — viz `../lifecycle.ts`).
   *
   * Dřív se na tomhle místě jen odmítlo („zavolejte mi prosím") a telefonát
   * se nikde nezapsal. `pending` čeká na rozhodnutí majitelky, `approved`
   * znamená, že rezervaci zrušila (vrácení peněz je samostatné rozhodnutí),
   * `denied` že na zrušení nepřistoupila. Null = žádost nikdy nebyla.
   */
  cancel_request_status: model
    .enum(["pending", "approved", "denied"])
    .index()
    .nullable(),
  cancel_requested_at: model.dateTime().nullable(),
  /** Důvod vlastními slovy zákazníka — majitelka podle něj rozhoduje. */
  cancel_request_note: model.text().nullable(),
  cancel_decided_at: model.dateTime().nullable(),
  /** Co majitelka k rozhodnutí napsala; jde zákazníkovi v e-mailu. */
  cancel_decision_note: model.text().nullable(),
  source: model.enum(["web", "manual"]).default("web"),
  /** The owner's own note („zavolala paní Nováková, přijdou 3"). */
  note: model.text().nullable(),
  /**
   * Souhlasy z webové rezervace (`CourseReservationConsents` v `../legal.ts`):
   * verze OP, čas, poučení o výjimce z odstoupení (§ 1837 písm. j) OZ),
   * nepovinný souhlas s fotkami a otisk zobrazených storno podmínek. Důkaz
   * pro případ sporu. Null u ručních rezervací a u starších řádků.
   */
  consents: model.json().nullable(),
  payment_collection_id: model.text().index().nullable(),
  payment_session_id: model.text().index().nullable(),
  provider_transaction_id: model.text().nullable(),
  payment_url: model.text().nullable(),
  /** iDoklad idempotency facts, stamped once the invoice exists. */
  idoklad_invoice_id: model.number().nullable(),
  idoklad_invoice_number: model.text().nullable(),
  idoklad_pdf_url: model.text().nullable(),
})
