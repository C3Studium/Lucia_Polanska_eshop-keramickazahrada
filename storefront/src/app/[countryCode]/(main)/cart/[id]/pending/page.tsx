import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getMerchantIdentity } from "@lib/data/merchant"
import { retrieveOrder } from "@lib/data/orders"
import PaymentPending from "@modules/cart/components/payment-pending"

type Props = {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Čekáme na potvrzení platby",
  description: "Vaše objednávka je uložená a čeká na potvrzení platby.",
}

export default async function PaymentPendingPage(props: Props) {
  const { id } = await props.params

  if (!id) {
    return notFound()
  }

  // The ComGate return URL carries the cart id; an order may or may not exist for it yet.
  const order = await retrieveOrder(id).catch(() => null)
  const merchant = getMerchantIdentity()

  return (
    <PaymentPending
      reference={id}
      orderNumber={order?.display_id ? `#${order.display_id}` : undefined}
      supportEmail={merchant.email}
      supportPhone={merchant.phone}
    />
  )
}
