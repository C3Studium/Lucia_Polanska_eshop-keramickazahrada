import { Metadata } from "next"
import s from "../styles/orders.module.scss"
import { notFound } from "next/navigation"
import { listOrders } from "@lib/data/orders"
import OrdersTemplate from "@modules/account/templates/orders-template"


export const metadata: Metadata = {
  title: "Moje objednávky",
  description: "Přehled předchozích objednávek a jejich stavu.",
}

export default async function Orders() {
  const orders = await listOrders()

  if (!orders) {
    notFound()
  }

  return (
    <main className={s.root}>
      <OrdersTemplate orders={orders} />
    </main>
  )
}
