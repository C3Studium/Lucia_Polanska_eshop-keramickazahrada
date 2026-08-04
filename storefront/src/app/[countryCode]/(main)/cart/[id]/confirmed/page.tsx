import { Metadata } from "next"
import { notFound } from "next/navigation"
import PaymentConfirmed from "@modules/cart/components/payment-confirmed"
type Props = {
  params: Promise<{ id: string }>
}
export const metadata: Metadata = {
  title: "Objednávka potvrzena",
  description: "Vaše objednávka byla úspěšně dokončena.",
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  if (!params.id) {
    return notFound()
  }
  return <PaymentConfirmed id={params.id} />
}
