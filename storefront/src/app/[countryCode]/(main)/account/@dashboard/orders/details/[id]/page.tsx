import { retrieveOrder, getOrderAccessToken } from "@lib/data/orders"
import { getOrderClaims } from "@lib/data/claims"
import OrderDetailsTemplate from "@modules/order/templates/order-details-template"
import { CLAIM_FORM_KEY } from "@modules/order/components/carrier-damage"
import { getSiteDocument } from "@lib/data/documents"
import OrderEdit from "@modules/order/components/order-edit"
import { getOrderEditContext } from "@lib/data/order-edit"
import { getCommissionBalance, listCommissionNotes } from "@lib/data/made-to-order"
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
  // `null` = není zakázka (route 404) → konverzace se nevykreslí; prázdné pole
  // = zakázka, kde se zatím nepsalo, a ta tlačítko mít má.
  const commissionNotes = await listCommissionNotes(order.id)
  // Doplatek zakázky (zbývá-li co doplatit) → panel s tlačítkem „Doplatit".
  const commissionBalance = await getCommissionBalance(order.id)
  // Reklamace / vrácení jede přes podepsaný token (stejně jako z e-mailu a z
  // potvrzení) — tady ho získáme za přihlášeného. `null` → formulář se nenabídne.
  const selfServiceToken = await getOrderAccessToken(order.id)
  const claims = selfServiceToken
    ? await getOrderClaims(order.id, selfServiceToken)
    : null

  return (
    <>
      {editContext && <OrderEdit orderId={order.id} context={editContext} />}
      <OrderDetailsTemplate
        order={order}
        claimForm={claimForm}
        commissionNotes={commissionNotes}
        commissionBalance={commissionBalance}
        selfServiceToken={selfServiceToken}
        claims={claims}
      />
    </>
  )
}
