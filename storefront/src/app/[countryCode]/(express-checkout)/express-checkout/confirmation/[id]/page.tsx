import { retrieveOrder } from "@lib/data/orders"
import ExpressResult from "@modules/express-checkout/Result"
import { getPageCopy } from "@lib/data/site-copy"
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

  // Texty poděkování z bloku `kosik.rychly-vysledek`; výpadek CMS = texty z kódu.
  const copy = await getPageCopy("kosik")

  return (
    <ExpressResult
      status="success"
      countryCode={countryCode}
      order={order}
      block={copy["kosik.rychly-vysledek"]}
    />
  )
}
