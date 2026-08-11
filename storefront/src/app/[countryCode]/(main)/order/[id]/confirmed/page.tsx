import { retrieveOrder } from "@lib/data/orders"
import { fallbackStageLabel, getOrderProgress } from "@lib/data/order-progress"
import { listCommissionNotes } from "@lib/data/made-to-order"
import OrderCompletedTemplate from "@modules/order/templates/order-completed-template"
import BalancePaymentNotice from "@modules/order/components/balance-payment-notice"
import OrderStateShell from "@modules/order/components/order-state-shell"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ platba?: string }>
}

export const metadata: Metadata = {
  title: "Objednávka potvrzena",
  description: "Objednávku máme, děkujeme.",
}

export default async function OrderConfirmedPage(props: Props) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams])
  const order = await retrieveOrder(params.id).catch(() => null)
  const outcome = searchParams.platba
  // Null for a guest, for someone else's order, or while the merchant workflow has no stage.
  const progress = order ? await getOrderProgress(params.id) : null

  /*
   * The zakázka's diary. The route 404s for an order that is not a commission, and the fetcher
   * turns that into an empty list — so `null` here means "not a zakázka, draw nothing" while an
   * empty array means "a zakázka with nothing said yet", which still deserves the box.
   */
  const commissionNotes = order ? await listCommissionNotes(params.id) : null

  /*
   * The backend redirects here after a balance payment (§4.6). That link is e-mailed, so it is
   * often opened by a guest or in a browser with no session — and then the order cannot be
   * loaded. Showing a 404 to someone who has just paid reads as "it did not work", and the
   * usual response to that is paying twice. The acknowledgement comes first; the order detail
   * is a bonus when we can load it.
   */
  if (!order) {
    if (outcome) {
      return (
        <OrderStateShell
          eyebrow="Platba · doplatek"
          title="Máme to."
          accent="Objednávka je v pořádku."
          description="Podrobnosti se nám tu nepovedlo načíst. Najdete je v e-mailu s potvrzením, nebo ve svém účtu."
          status={outcome === "paid" ? "success" : "pending"}
          primary={{ href: "/account/orders", label: "Moje objednávky" }}
        >
          <BalancePaymentNotice outcome={outcome} inline />
        </OrderStateShell>
      )
    }

    return notFound()
  }

  return (
    <>
      <BalancePaymentNotice outcome={outcome} />
      <OrderCompletedTemplate
        order={order}
        progress={progress}
        progressFallback={fallbackStageLabel(order)}
        commissionNotes={commissionNotes}
      />
    </>
  )
}
