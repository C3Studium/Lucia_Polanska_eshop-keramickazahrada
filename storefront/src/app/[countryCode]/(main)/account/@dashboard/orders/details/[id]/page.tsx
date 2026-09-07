import { retrieveOrder } from "@lib/data/orders"
import OrderDetailsTemplate from "@modules/order/templates/order-details-template"
import { CLAIM_FORM_KEY } from "@modules/order/components/carrier-damage"
import { getSiteDocument } from "@lib/data/documents"
import OrderEdit from "@modules/order/components/order-edit"
import { getOrderEditContext } from "@lib/data/order-edit"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    notFound()
  }

  return {
    title: `Objednávka #${order.display_id}`,
    description: "Detail objednávky — co jste objednali, doprava i platba.",
  }
}

export default async function OrderDetailPage(props: Props) {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    notFound()
  }

  const editContext = await getOrderEditContext(order.id)
  // Načítá se tady, protože tahle stránka je serverová — šablona pod ní
  // je klientská a datová vrstva `server-only`.
  const claimForm = await getSiteDocument(CLAIM_FORM_KEY)

  return (
    <>
      {editContext && <OrderEdit orderId={order.id} context={editContext} />}
      <OrderDetailsTemplate order={order} claimForm={claimForm} />
    </>
  )
}
