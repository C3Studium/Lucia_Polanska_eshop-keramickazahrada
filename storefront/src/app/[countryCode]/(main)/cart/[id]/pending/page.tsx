import { retrieveOrder } from "@lib/data/orders"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}
export const metadata: Metadata = {
  title: "Order Confirmed",
  description: "You purchase was successful",
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)
  const cart = params.id

  if (!cart) {
    return notFound()
  }

  return <div className="h-full w-full items-center justify-center">
    <h1>pending page</h1>
  </div>
}
