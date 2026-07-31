import { Metadata } from "next"

import Overview from "@modules/account/components/overview"
import { notFound } from "next/navigation"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"

export const metadata: Metadata = {
  title: "Můj účet",
  description: "Přehled objednávek a osobních údajů.",
}

export default async function OverviewTemplate() {
  const customer = await retrieveCustomer().catch(() => null)
  let orders = (await listOrders().catch(() => null)) || null

  // If orders API failed but customer has orders, use customer orders
  if (!orders && (customer as any)?.orders && (customer as any).orders.length > 0) {
    orders = (customer as any).orders
  }

  if (!customer) {
    notFound()
  }

  return <Overview customer={customer} orders={orders} />
}
