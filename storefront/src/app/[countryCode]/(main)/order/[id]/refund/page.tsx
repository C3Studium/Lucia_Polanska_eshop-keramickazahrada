import { getGuestRefundContext } from "@lib/data/guest-refund"
import { listCommissionNotes } from "@lib/data/made-to-order"
import RefundRequest from "@modules/order/components/refund-request"
import CommissionConversation from "@modules/order/components/commission-conversation"
import OrderStateShell from "@modules/order/components/order-state-shell"
import { Metadata } from "next"

type Props = {
  params: Promise<{ id: string; countryCode: string }>
  searchParams: Promise<{ token?: string }>
}

export const metadata: Metadata = {
  title: "Reklamace, vrácení nebo odstoupení",
  description: "Reklamace zboží, vrácení nebo odstoupení od smlouvy.",
}

/**
 * Reklamace / vrácení / odstoupení od smlouvy k jedné objednávce — z e-mailu,
 * bez přihlášení, autorizováno podepsaným tokenem (`?token=`). Neplatný token =
 * slušné vysvětlení, ne 404. U zboží na míru se odstoupení nenabízí (§1837).
 */
export default async function OrderRefundPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const token = searchParams.token
  const context = token
    ? await getGuestRefundContext(params.id, token)
    : null
  // `null` = není zakázka → konverzace se nevykreslí. Čte přes publishable key,
  // takže funguje i hostovi z e-mailu (bez přihlášení).
  const commissionNotes = await listCommissionNotes(params.id)

  if (!context) {
    return (
      <OrderStateShell
        eyebrow="Objednávka · reklamace"
        kicker="Reklamace a vrácení"
        title="Odkaz nejde otevřít."
        description="Odkaz je neplatný nebo vypršel. Otevřete prosím ten z posledního e-mailu, nebo nám napište na info@keramickazahrada.cz."
        status="pending"
        primary={{ href: "/account/orders", label: "Moje objednávky" }}
      />
    )
  }

  return (
    <OrderStateShell
      eyebrow="Objednávka · reklamace"
      kicker={`Objednávka #${context.order_display_id}`}
      title="Reklamace, vrácení nebo odstoupení."
      description="Vyberte, co chcete řešit, napište pár slov a odešlete. Ozveme se vám e-mailem."
      status="pending"
      primary={{ href: "/account/orders", label: "Moje objednávky" }}
    >
      <RefundRequest context={context} />
      {commissionNotes && (
        <CommissionConversation orderId={params.id} notes={commissionNotes} />
      )}
    </OrderStateShell>
  )
}
