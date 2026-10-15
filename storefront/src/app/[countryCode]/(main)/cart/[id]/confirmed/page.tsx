import { Metadata } from "next"
import { notFound } from "next/navigation"
import PaymentConfirmed from "@modules/cart/components/payment-confirmed"
import { getMerchantIdentity } from "@lib/data/merchant"
import { getPageCopy } from "@lib/data/site-copy"
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

  const merchant = await getMerchantIdentity()
  // Texty čekání z bloku `kosik.platba-potvrzena`; výpadek CMS = texty z kódu.
  const copy = await getPageCopy("kosik")

  return (
    <PaymentConfirmed
      id={params.id}
      supportEmail={merchant.email}
      supportPhone={merchant.phone}
      block={copy["kosik.platba-potvrzena"]}
    />
  )
}
