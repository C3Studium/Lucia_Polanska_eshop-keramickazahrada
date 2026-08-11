import OrderTransferTemplate from "@modules/order/templates/order-transfer-template"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Převod objednávky",
  description: "Rozhodněte, jestli objednávku převzít.",
}

export default async function TransferPage({
  params,
}: {
  params: Promise<{ id: string; token: string }>
}) {
  const { id, token } = await params

  return <OrderTransferTemplate id={id} token={token} state="pending" />
}
