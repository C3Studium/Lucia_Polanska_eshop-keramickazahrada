import { retrieveOrder } from "@lib/data/orders"
import ExpressResult from "@modules/express-checkout/Result"
import { notFound } from "next/navigation"

type Params = {
  params: Promise<{ id: string; countryCode: string }>
}

export default async function ConfirmationPage ({
  params
}: Params) {
  const { id, countryCode } = await params
  const order = await retrieveOrder(id).catch(() => null)
  if (!order) notFound()

  return (
    <ExpressResult
      status="success"
      countryCode={countryCode}
      order={order}
    />
  )
}
