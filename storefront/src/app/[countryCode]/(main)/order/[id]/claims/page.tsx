import { getOrderClaims } from "@lib/data/claims"
import { getGuestRefundContext } from "@lib/data/guest-refund"
import { retrieveCustomer } from "@lib/data/customer"
import { findOpenClaim } from "@lib/util/claims"
import ClaimStatus from "@modules/order/components/claim-status"
import OrderStateShell from "@modules/order/components/order-state-shell"
import { Metadata } from "next"

type Props = {
  params: Promise<{ id: string; countryCode: string }>
  searchParams: Promise<{ token?: string }>
}

export const metadata: Metadata = {
  title: "Stav reklamace a vrácení",
  description: "V jaké fázi je vaše reklamace, vrácení nebo odstoupení od smlouvy.",
}

/**
 * Stav žádostí (reklamace / vrácení / odstoupení) k jedné objednávce — z
 * e-mailu i z potvrzení, bez přihlášení, autorizováno podepsaným tokenem
 * (`?token=`). Časová osa ke každé žádosti, protokol, adresa a pokyny pro
 * vrácení, číslo zásilky. Neplatný token = slušné vysvětlení, ne 404.
 */
export default async function OrderClaimsPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const token = searchParams.token
  const [claims, context] = token
    ? await Promise.all([
        getOrderClaims(params.id, token),
        getGuestRefundContext(params.id, token),
      ])
    : [null, null]
  const customer = await retrieveCustomer().catch(() => null)
  const myOrdersAction = customer
    ? { href: "/account/orders", label: "Moje objednávky" }
    : undefined

  if (!token || !claims) {
    // Token prošel (legacy kontext se načetl), jen stav žádostí ne → výpadek,
    // ne neplatný odkaz.
    const tokenOk = Boolean(token && context)
    return (
      <OrderStateShell
        eyebrow="Objednávka · reklamace"
        kicker={
          tokenOk && context
            ? `Objednávka #${context.order_display_id}`
            : "Reklamace a vrácení"
        }
        title={tokenOk ? "Teď to nejde načíst." : "Odkaz nejde otevřít."}
        description={
          tokenOk
            ? "Stav žádostí se nám teď nepodařilo načíst. Zkuste to prosím za chvíli znovu, nebo nám napište na info@keramickazahrada.cz."
            : "Odkaz je neplatný nebo vypršel. Otevřete prosím ten z posledního e-mailu, nebo nám napište na info@keramickazahrada.cz."
        }
        status="pending"
        primary={myOrdersAction}
      />
    )
  }

  const count = claims.requests.length
  const openClaim = findOpenClaim(claims)
  const kicker = context
    ? `Objednávka #${context.order_display_id}`
    : "Reklamace a vrácení"

  return (
    <OrderStateShell
      eyebrow="Objednávka · reklamace"
      kicker={kicker}
      title={count > 1 ? "Stav vašich žádostí." : "Stav vaší žádosti."}
      description={
        count === 0
          ? "K této objednávce zatím žádnou reklamaci ani vrácení nemáme."
          : openClaim
            ? "Každý krok, který se stane, tu uvidíte — a zároveň vám přijde e-mail. Peníze vracíme až po rozhodnutí, u vrácení zboží zpravidla po jeho přijetí."
            : "Všechny žádosti k této objednávce jsou uzavřené. Kdyby se objevilo něco dalšího, podejte novou."
      }
      status={openClaim ? "pending" : "success"}
      primary={myOrdersAction}
      // Další žádost až po uzavření té předchozí (server povolí jen jednu
      // otevřenou). Prázdný výpis má vlastní tlačítko přímo ve výpisu.
      secondary={
        count > 0 && !openClaim
          ? {
              href: `/order/${params.id}/refund?token=${encodeURIComponent(token)}`,
              label: "Podat další žádost",
            }
          : undefined
      }
    >
      <ClaimStatus
        orderId={params.id}
        token={token}
        claims={claims}
        currencyCode={context?.currency_code}
      />
    </OrderStateShell>
  )
}
