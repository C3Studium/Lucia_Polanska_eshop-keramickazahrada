import PaymentCanceled from "@modules/cart/components/payment-canceled"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string; countryCode: string }>
}
export const metadata: Metadata = {
  title: "Platba nebyla dokončena",
  description: "Vraťte se a objednávku v klidu dokončete.",
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  const cart = params.id

  if (!cart) {
    return notFound()
  }

  return <PaymentCanceled />
}
