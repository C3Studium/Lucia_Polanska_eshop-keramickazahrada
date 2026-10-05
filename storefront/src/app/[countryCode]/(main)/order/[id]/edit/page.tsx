import { getGuestOrderEditContext } from "@lib/data/guest-order-edit"
import { listCommissionNotes } from "@lib/data/made-to-order"
import OrderEdit from "@modules/order/components/order-edit"
import CommissionConversation from "@modules/order/components/commission-conversation"
import OrderStateShell from "@modules/order/components/order-state-shell"
import { Metadata } from "next"

type Props = {
  params: Promise<{ id: string; countryCode: string }>
  searchParams: Promise<{ token?: string }>
}

export const metadata: Metadata = {
  title: "Úprava objednávky",
  description: "Upravte si svou objednávku.",
}

/**
 * Úprava objednávky z e-mailového odkazu — BEZ přihlášení, autorizováno
 * podepsaným tokenem (`?token=`). Když token chybí/neplatí, nejde o 404, ale
 * o slušné vysvětlení (odkaz vede z e-mailu, často ho otevře host). Pravidla
 * úprav soudí backend (žádné zakázky, nesmí zbýt prázdno, matice peněz).
 */
export default async function OrderEditPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const token = searchParams.token
  const context = token
    ? await getGuestOrderEditContext(params.id, token)
    : null
  // `null` = není zakázka → konverzace se nevykreslí. Čte přes publishable key,
  // takže funguje i hostovi z e-mailu (bez přihlášení).
  const commissionNotes = await listCommissionNotes(params.id)

  if (!context) {
    return (
      <OrderStateShell
        eyebrow="Objednávka · úprava"
        kicker="Úprava objednávky"
        title="Odkaz nejde otevřít."
        description="Odkaz na úpravu je neplatný nebo vypršel. Otevřete prosím ten z posledního e-mailu, nebo se nám ozvěte a upravíme to spolu."
        status="pending"
        primary={{ href: "/account/orders", label: "Moje objednávky" }}
      />
    )
  }

  return (
    <OrderStateShell
      eyebrow="Objednávka · úprava"
      kicker="Úprava objednávky"
      title="Upravte si objednávku."
      accent="Dokud ji nezabalíme."
      description="Vyměňte variantu nebo odeberte položku — rozdíl ceny uvidíte ještě před uložením. Zakázkové kusy upravujeme po telefonu."
      status="pending"
      primary={{ href: "/account/orders", label: "Moje objednávky" }}
    >
      <OrderEdit orderId={params.id} context={context} token={token} />
      {commissionNotes && (
        <CommissionConversation orderId={params.id} notes={commissionNotes} />
      )}
    </OrderStateShell>
  )
}
