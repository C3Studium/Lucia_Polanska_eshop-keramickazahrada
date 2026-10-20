import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getMerchantIdentity } from "@lib/data/merchant"
import { getPageCopy } from "@lib/data/site-copy"
import { retrieveOrder } from "@lib/data/orders"
import PaymentPending from "@modules/cart/components/payment-pending"

type Props = {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Čekáme na potvrzení platby",
  description: "Objednávku máme, čekáme jen na potvrzení platby.",
}

export default async function PaymentPendingPage(props: Props) {
  const { id } = await props.params

  if (!id) {
    return notFound()
  }

  // The ComGate return URL carries the cart id; an order may or may not exist for it yet.
  const order = await retrieveOrder(id).catch(() => null)
  const merchant = await getMerchantIdentity()
  // Texty čekání na banku z bloku `kosik.platba-ceka`; výpadek CMS = texty z kódu.
  const copy = await getPageCopy("kosik")

  return (
    <PaymentPending
      reference={id}
      orderNumber={order?.display_id ? `#${order.display_id}` : undefined}
      supportEmail={merchant.email}
      supportPhone={merchant.phone}
      block={copy["kosik.platba-ceka"]}
    />
  )
}
