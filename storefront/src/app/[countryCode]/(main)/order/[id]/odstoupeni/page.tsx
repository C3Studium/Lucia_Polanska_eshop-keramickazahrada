import { getOrderClaims } from "@lib/data/claims"
import { retrieveCustomer } from "@lib/data/customer"
import { getLegalFacts } from "@lib/data/legal-facts"
import { getOrderAccessToken } from "@lib/data/orders"
import OrderStateShell from "@modules/order/components/order-state-shell"
import WithdrawalFlow from "@modules/order/components/withdrawal"
import { Metadata } from "next"

type Props = {
  params: Promise<{ id: string; countryCode: string }>
  searchParams: Promise<{ token?: string }>
}

export const metadata: Metadata = {
  title: "Odstoupení od smlouvy",
  description:
    "Odstoupení od kupní smlouvy online — předvyplněný formulář, kontrola a potvrzení e-mailem s datem a časem odeslání.",
  robots: { index: false, follow: false },
}

/**
 * Odstoupení od smlouvy online (§ 1830a OZ) — cíl tlačítka „Odstoupit od
 * smlouvy" z účtu, z potvrzení objednávky a z e-mailů o odeslání a převzetí.
 *
 * Kdo sem smí: podepsaný token z e-mailu (`?token=`, i host bez účtu), nebo
 * přihlášený vlastník objednávky — tomu token vyzvedneme sami
 * (`/store/orders/:id/self-service` ho vydá jen vlastníkovi). Neplatný
 * odkaz = slušné vysvětlení s e-mailem, kterým lze odstoupit vždy (§ 1830).
 *
 * Formulář, kontrola i potvrzení jsou v `WithdrawalFlow`; co jde (lhůta od
 * převzetí, zakázka, běžící odstoupení), říká server.
 */
export default async function OrderWithdrawalPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const token =
    searchParams.token || (await getOrderAccessToken(params.id).catch(() => null))
  const claims = token ? await getOrderClaims(params.id, token) : null
  const customer = await retrieveCustomer().catch(() => null)
  const myOrdersAction = customer
    ? { href: "/account/orders", label: "Moje objednávky" }
    : undefined

  if (!token || !claims) {
    return (
      <OrderStateShell
        eyebrow="Objednávka · odstoupení"
        kicker="Odstoupení od smlouvy"
        title={token ? "Teď to nejde načíst." : "Odkaz nejde otevřít."}
        description={
          token
            ? "Formulář se nám teď nepodařilo načíst. Zkuste to prosím za chvíli znovu. Od smlouvy můžete odstoupit vždy i e-mailem na info@keramickazahrada.cz — stačí napsat číslo objednávky a že odstupujete."
            : "Odkaz je neplatný nebo vypršel. Otevřete prosím ten z posledního e-mailu, nebo se přihlaste. Od smlouvy můžete odstoupit vždy i e-mailem na info@keramickazahrada.cz — stačí napsat číslo objednávky a že odstupujete."
        }
        status="pending"
        primary={myOrdersAction}
      />
    )
  }

  const orderNumber = claims.withdrawal?.order_display_id
  const kicker = orderNumber ? `Objednávka #${orderNumber}` : "Odstoupení od smlouvy"
  const hasRequests = claims.requests.length > 0

  return (
    <OrderStateShell
      eyebrow="Objednávka · odstoupení"
      kicker={kicker}
      title="Odstoupení od smlouvy."
      description={
        claims.can_withdraw
          ? "Zkontrolujte předvyplněné údaje a vyberte zboží. V dalším kroku uvidíte přesně, co odešleme, a teprve pak odstoupení potvrdíte. Potvrzení s obsahem a s datem a časem odeslání vám hned přijde e-mailem."
          : "U této objednávky teď od smlouvy odstoupit nejde — proč, najdete níže."
      }
      status="pending"
      primary={myOrdersAction}
      secondary={
        hasRequests
          ? {
              href: `/order/${params.id}/claims?token=${encodeURIComponent(token)}`,
              label: "Stav žádostí",
            }
          : undefined
      }
    >
      <WithdrawalFlow
        orderId={params.id}
        token={token}
        claims={claims}
        currencyCode={claims.withdrawal?.currency_code || undefined}
        facts={await getLegalFacts()}
      />
    </OrderStateShell>
  )
}
