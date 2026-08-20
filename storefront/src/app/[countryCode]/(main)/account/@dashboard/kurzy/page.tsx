import { Metadata } from "next"
import { notFound } from "next/navigation"

import { retrieveCustomer } from "@lib/data/customer"
import { listMyCourseReservations } from "@lib/data/courses"
import AccountKurzy from "@modules/kurzy/AccountKurzy"

import s from "../styles/profile.module.scss"

export const metadata: Metadata = {
  title: "Kurzy",
  description: "Vaše rezervace keramických kurzů.",
}

/**
 * The customer's course reservations. The list comes from
 * `/store/customers/me/course-reservations`, which also matches guest
 * bookings made with the account's e-mail — so a reservation made before
 * registering still shows up here.
 */
export default async function KurzyPage() {
  const customer = await retrieveCustomer()

  if (!customer) {
    notFound()
  }

  const reservations = await listMyCourseReservations()

  return (
    <main className={s.root}>
      <AccountKurzy reservations={reservations} />
    </main>
  )
}
