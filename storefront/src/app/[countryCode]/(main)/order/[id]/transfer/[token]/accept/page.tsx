import { acceptTransferRequest } from "@lib/data/orders"
import OrderTransferTemplate from "@modules/order/templates/order-transfer-template"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Převod objednávky potvrzen",
  description: "Výsledek převodu vlastnictví objednávky.",
}

export default async function AcceptTransferPage({
  params,
}: {
  params: Promise<{ id: string; token: string }>
}) {
  const { id, token } = await params
  const { success, error } = await acceptTransferRequest(id, token)

  return (
    <OrderTransferTemplate
      id={id}
      state={success ? "accepted" : "error"}
      error={error}
    />
  )
}
