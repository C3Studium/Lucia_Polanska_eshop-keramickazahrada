import { redirect } from "next/navigation"
import { retrieveOrderIdByPaymentSession } from "@lib/data/made-to-order"
import BalancePaymentNotice from "@modules/order/components/balance-payment-notice"
import OrderStateShell from "@modules/order/components/order-state-shell"

/**
 * Where ComGate lands the customer after a balance payment when the session
 * carried no explicit `url_paid` — the fallback `/{country}/payment/{session}/
 * {confirmed|canceled|pending}`. Historically a 404; now it resolves the session
 * to its order and sends the customer to that order's page with the outcome, so
 * „zaplaceno / zrušeno / čeká" always lands somewhere real with doplatek info.
 *
 * When the session cannot be mapped (unknown/expired), it shows a graceful
 * acknowledgement instead of a dead end — the payment is recorded server-side by
 * the webhook/job regardless.
 */
export default async function PaymentSessionReturn({
  countryCode,
  sessionId,
  outcome,
}: {
  countryCode: string
  sessionId: string
  /** The query value the order page reads via `?platba=`. */
  outcome: "paid" | "zruseno" | "ceka"
}) {
  const orderId = await retrieveOrderIdByPaymentSession(sessionId)

  if (orderId) {
    redirect(`/${countryCode}/order/${orderId}/confirmed?platba=${outcome}`)
  }

  const success = outcome === "paid"
  return (
    <OrderStateShell
      eyebrow="Platba · doplatek"
      title={success ? "Máme to." : "Platba doplatku"}
      accent={success ? "Doplatek je zaplacený." : undefined}
      description="Podrobnosti najdete v e-mailu s potvrzením nebo ve svém účtu."
      status={success ? "success" : "pending"}
      primary={{ href: "/account/orders", label: "Moje objednávky" }}
    >
      <BalancePaymentNotice outcome={outcome} inline />
    </OrderStateShell>
  )
}
