import { model } from "@medusajs/framework/utils"
import { CourseReservation } from "./course-reservation"

/**
 * Doplatek nebo vratka k rezervaci kurzu po změně počtu osob.
 *
 * Vzor jako zakázka (`production_payment_request`): každý pohyb peněz po
 * prvotní platbě má vlastní řádek s částkou, stavem a vlastní ComGate platbou.
 * Prvotní platba zůstává na rezervaci (`payment_collection_id`,
 * `payment_session_id`), aby se nic stávajícího nerozbilo.
 *
 * - `supplement`: zákazník přidal osoby (nebo vyšší cenová hladina) → doplácí
 *   rozdíl novou platbou (`pending` → `paid`, nebo `cancelled`, když ji
 *   nahradí další úprava).
 * - `refund`: zákazník ubral osoby → rozdíl se vrací přes ComGate
 *   (`refunded`, nebo `failed` → vrátit ručně, majitelka dostane zprávu).
 */
export const CoursePaymentRequest = model.define("course_payment_request", {
  id: model.id().primaryKey(),
  reservation: model.belongsTo(() => CourseReservation, {
    mappedBy: "payment_requests",
  }),
  type: model.enum(["supplement", "refund"]),
  status: model
    .enum(["pending", "paid", "cancelled", "refunded", "failed"])
    .index()
    .default("pending"),
  amount: model.bigNumber(),
  /** Počet osob a cena celkem, po kterých tenhle pohyb vznikl. */
  party_size: model.number(),
  total_price: model.bigNumber(),
  payment_collection_id: model.text().index().nullable(),
  payment_session_id: model.text().index().nullable(),
  payment_url: model.text().nullable(),
  paid_at: model.dateTime().nullable(),
  /** Proč selhalo vrácení, nebo poznámka k ručnímu vyřízení. */
  note: model.text().nullable(),
})
