import { declineTransferRequest } from "@lib/data/orders"
import OrderTransferTemplate from "@modules/order/templates/order-transfer-template"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Převod objednávky odmítnut",
  description: "Výsledek převodu vlastnictví objednávky.",
}

export default async function DeclineTransferPage({
  params,
}: {
  params: Promise<{ id: string; token: string }>
}) {
  const { id, token } = await params
  const { success, error } = await declineTransferRequest(id, token)

  return (
    <OrderTransferTemplate
      id={id}
      state={success ? "declined" : "error"}
      error={error}
    />
  )
}
