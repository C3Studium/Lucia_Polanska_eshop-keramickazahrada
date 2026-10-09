import { getOrderClaims } from "@lib/data/claims"
import { getGuestRefundContext } from "@lib/data/guest-refund"
import { retrieveCustomer } from "@lib/data/customer"
import { getSiteDocument } from "@lib/data/documents"
import { listCommissionNotes } from "@lib/data/made-to-order"
import { findOpenClaim } from "@lib/util/claims"
import { CLAIM_FORM_KEY } from "@modules/order/components/carrier-damage"
import RefundRequest from "@modules/order/components/refund-request"
import CommissionConversation from "@modules/order/components/commission-conversation"
import OrderStateShell from "@modules/order/components/order-state-shell"
import { Metadata } from "next"

type Props = {
  params: Promise<{ id: string; countryCode: string }>
  searchParams: Promise<{ token?: string; kind?: string }>
}

export const metadata: Metadata = {
  title: "Reklamace, vrácení nebo odstoupení",
  description: "Reklamace zboží, vrácení nebo odstoupení od smlouvy.",
}

/**
 * Reklamace / vrácení / odstoupení od smlouvy k jedné objednávce — z e-mailu,
 * z potvrzení i z účtu, bez přihlášení, autorizováno podepsaným tokenem
 * (`?token=`). Neplatný token = slušné vysvětlení, ne 404.
 *
 * Co jde podat, říká SERVER (`GET /store/orders/:id/claims`): zakázka §1837,
 * lhůta 14 dnů, otevřená žádost. Formulář jen zamkne volbu a ukáže důvod.
 */
export default async function OrderRefundPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const token = searchParams.token
  const [claims, context, claimForm] = token
    ? await Promise.all([
        getOrderClaims(params.id, token),
        // Jen kvůli číslu objednávky a měně v hlavičce; gating je z `claims`.
        getGuestRefundContext(params.id, token),
        // Dokument „co dělat s poškozenou zásilkou" — nápověda u přepínače
        // „Balík dorazil poškozený" na něj odkáže (§11.3). `null` = nenahráno.
        getSiteDocument(CLAIM_FORM_KEY),
      ])
    : [null, null, null]
  // `null` = není zakázka → konverzace se nevykreslí. Čte přes publishable key,
  // takže funguje i hostovi z e-mailu (bez přihlášení).
  const commissionNotes = await listCommissionNotes(params.id)
  // „Moje objednávky" nabídneme JEN přihlášenému — host žádný výpis objednávek
  // nemá (odkaz by vedl na přihlášení). `null` = host.
  const customer = await retrieveCustomer().catch(() => null)
  const myOrdersAction = customer
    ? { href: "/account/orders", label: "Moje objednávky" }
    : undefined

  if (!token || !claims) {
    // Token prošel (legacy kontext se načetl), jen stav žádostí ne → není to
    // neplatný odkaz, ale výpadek; říct to tak, ať člověk nehledá nový e-mail.
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
            ? "Stav reklamací se nám teď nepodařilo načíst. Zkuste to prosím za chvíli znovu, nebo nám napište na info@keramickazahrada.cz."
            : "Odkaz je neplatný nebo vypršel. Otevřete prosím ten z posledního e-mailu, nebo nám napište na info@keramickazahrada.cz."
        }
        status="pending"
        primary={myOrdersAction}
      />
    )
  }

  const openClaim = findOpenClaim(claims)
  const kicker = context
    ? `Objednávka #${context.order_display_id}`
    : "Reklamace a vrácení"

  return (
    <OrderStateShell
      eyebrow="Objednávka · reklamace"
      kicker={kicker}
      title={openClaim ? "Vaše žádost běží." : "Reklamace, vrácení nebo odstoupení."}
      description={
        openClaim
          ? "Tady vidíte, v jaké fázi žádost je. Jakmile rozhodneme nebo k nám dorazí zboží, dáme vám vědět e-mailem."
          : "Vyberte, co chcete řešit, napište pár slov a odešlete. Potvrzení s protokolem přijde e-mailem."
      }
      status="pending"
      primary={myOrdersAction}
      secondary={
        claims.requests.length
          ? {
              href: `/order/${params.id}/claims?token=${encodeURIComponent(token)}`,
              label: "Stav žádostí",
            }
          : undefined
      }
    >
      <RefundRequest
        orderId={params.id}
        token={token}
        claims={claims}
        initialKind={searchParams.kind}
        currencyCode={context?.currency_code}
        claimForm={claimForm}
      />
      {commissionNotes && (
        <CommissionConversation orderId={params.id} notes={commissionNotes} />
      )}
    </OrderStateShell>
  )
}
