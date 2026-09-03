import { Metadata } from "next"

import Overview from "@modules/account/components/overview"
import { redirect } from "next/navigation"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"

export const metadata: Metadata = {
  title: "Můj účet",
  description: "Vaše objednávky a osobní údaje na jednom místě.",
}

export default async function OverviewTemplate({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const customer = await retrieveCustomer().catch(() => null)

  /*
   * Signed out is a redirect, not a 404. `notFound()` here told a visitor with an expired session
   * that their account does not exist, and it ran before the orders call could be reached — so
   * the page rendered an error instead of the login form the layout is built to show.
   *
   * Checked before the orders are fetched, so a signed-out request never asks the backend for
   * something it cannot have.
   */
  if (!customer) {
    redirect(`/${countryCode}/account`)
  }

  let orders = (await listOrders().catch(() => null)) || null

  // If orders API failed but customer has orders, use customer orders
  if (!orders && (customer as any)?.orders && (customer as any).orders.length > 0) {
    orders = (customer as any).orders
  }

  return <Overview customer={customer} orders={orders} />
}
