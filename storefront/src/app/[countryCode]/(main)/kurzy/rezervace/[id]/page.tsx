import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCourseReservation } from "@lib/data/courses"
import { getPageCopy } from "@lib/data/site-copy"
import RezervaceDetail from "@modules/kurzy/RezervaceDetail"

export const metadata: Metadata = {
  title: "Rezervace kurzu",
  description: "Stav vaší rezervace keramického kurzu.",
}

/**
 * The reservation page — where ComGate returns the customer
 * (`?vysledek=paid|cancelled|pending`) and where the e-mail button lands.
 * Access is proven by the signed `token`; without a valid one this is a 404,
 * so reservation ids alone reveal nothing.
 */
export default async function RezervacePage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string; vysledek?: string }>
}) {
  const [{ id }, { token, vysledek }] = await Promise.all([
    props.params,
    props.searchParams,
  ])

  if (!token) {
    notFound()
  }

  // Rezervace z Medusy, texty stavů z CMS (blok `kurzy.rezervace-stavy`);
  // výpadek CMS = texty z kódu, ne chyba.
  const [reservation, copy] = await Promise.all([
    getCourseReservation(id, token),
    getPageCopy("kurzy"),
  ])
  if (!reservation) {
    notFound()
  }

  return (
    <RezervaceDetail
      reservation={reservation}
      token={token}
      outcome={vysledek}
      block={copy["kurzy.rezervace-stavy"]}
    />
  )
}
