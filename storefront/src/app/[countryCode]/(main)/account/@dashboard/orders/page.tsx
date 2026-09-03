import { Metadata } from "next"
import s from "../styles/orders.module.scss"
import { redirect } from "next/navigation"
import { listOrders } from "@lib/data/orders"
import OrdersTemplate from "@modules/account/templates/orders-template"


export const metadata: Metadata = {
  title: "Moje objednávky",
  description: "Přehled předchozích objednávek a jejich stavu.",
}

export default async function Orders() {
  const orders = await listOrders()

  /*
   * `listOrders` returns null for an unauthenticated request now — it used to throw, which is
   * what put „[medusa] request setup failed: Unauthorized" in the console and took the page with
   * it. A signed-out visitor belongs at the login form, not on a 404.
   *
   * An empty account still renders: `listOrders` gives back `[]`, not null, when there is nobody
   * to show orders for but a session exists.
   */
  if (!orders) {
    redirect("/account")
  }

  return (
    <main className={s.root}>
      <OrdersTemplate orders={orders} />
    </main>
  )
}
