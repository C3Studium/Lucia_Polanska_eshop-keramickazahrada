import PaymentSessionReturn from "@modules/order/components/payment-session-return"

type Props = {
  params: Promise<{ countryCode: string; sessionId: string }>
}

/** ComGate fallback návrat, když se doplatek ještě zpracovává. */
export default async function PaymentPendingFallback({ params }: Props) {
  const { countryCode, sessionId } = await params
  return (
    <PaymentSessionReturn
      countryCode={countryCode}
      sessionId={sessionId}
      outcome="ceka"
    />
  )
}
