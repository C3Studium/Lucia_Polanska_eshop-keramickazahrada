import PaymentSessionReturn from "@modules/order/components/payment-session-return"

type Props = {
  params: Promise<{ countryCode: string; sessionId: string }>
}

/**
 * ComGate fallback návrat po úspěšném doplatku. Přesměruje na přehled objednávky
 * s `?platba=paid`; když session nejde namapovat, ukáže potvrzení místo 404.
 */
export default async function PaymentConfirmedFallback({ params }: Props) {
  const { countryCode, sessionId } = await params
  return (
    <PaymentSessionReturn
      countryCode={countryCode}
      sessionId={sessionId}
      outcome="paid"
    />
  )
}
