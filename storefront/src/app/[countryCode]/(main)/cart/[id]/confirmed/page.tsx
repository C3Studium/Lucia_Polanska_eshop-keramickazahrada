import { Metadata } from "next"
import { notFound } from "next/navigation"
import PaymentConfirmed from "@modules/cart/components/payment-confirmed"
import { getMerchantIdentity } from "@lib/data/merchant"
type Props = {
  params: Promise<{ id: string }>
}
export const metadata: Metadata = {
  title: "Objednávka potvrzena",
  description: "Objednávku máme, děkujeme.",
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  if (!params.id) {
    return notFound()
  }

  const merchant = getMerchantIdentity()

  return (
    <PaymentConfirmed
      id={params.id}
      supportEmail={merchant.email}
      supportPhone={merchant.phone}
    />
  )
}
