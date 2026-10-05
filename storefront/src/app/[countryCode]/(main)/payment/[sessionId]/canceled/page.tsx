import PaymentSessionReturn from "@modules/order/components/payment-session-return"

type Props = {
  params: Promise<{ countryCode: string; sessionId: string }>
}

/** ComGate fallback návrat po zrušeném doplatku. */
export default async function PaymentCanceledFallback({ params }: Props) {
  const { countryCode, sessionId } = await params
  return (
    <PaymentSessionReturn
      countryCode={countryCode}
      sessionId={sessionId}
      outcome="zruseno"
    />
  )
}
