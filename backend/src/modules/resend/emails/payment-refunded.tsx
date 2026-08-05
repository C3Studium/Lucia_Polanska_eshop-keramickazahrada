import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  Note,
  P,
  Signature,
} from "../components/email-ui"

interface PaymentRefundedEmailProps {
  customerName?: string;
  orderNumber?: string;
  refundAmount?: string;
  originalPaymentAmount?: string;
  refundReason?: string;
  refundMethod?: string;
  estimatedRefundTime?: string;
  orderLink?: string;
}

function PaymentRefundedEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  refundAmount = "1 250 Kč",
  originalPaymentAmount = "2 450 Kč",
  refundReason = "Částečné vrácení zboží",
  refundMethod = "Původní platební metoda",
  estimatedRefundTime = "3-5 pracovních dnů",
  orderLink = "https://keramickazahrada.cz/orders/12345"
}: PaymentRefundedEmailProps) {
  return (
    <EmailLayout preview={`Vracíme vám ${refundAmount} za objednávku ${orderNumber}.`}>
      <Eyebrow>Platba</Eyebrow>
      <EmailH1 accent="vracíme.">Platbu</EmailH1>

      <Greeting name={customerName} />
      <P>
        vrácení platby za vaši objednávku je zpracováno. Peníze se k vám
        vracejí stejnou cestou, jakou k nám přišly.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Důvod vrácení" value={refundReason} />
      <LedgerRow label="Způsob vrácení" value={refundMethod} />
      <LedgerRow label="Původní částka" value={originalPaymentAmount} />
      <LedgerRow label="Vráceno" value={refundAmount} strong tone="olive" />
      <LedgerEnd />

      <Note tone="olive">
        Peníze by se na vašem účtu měly objevit do {estimatedRefundTime}.
      </Note>

      <ButtonRow>
        <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton>
      </ButtonRow>

      <P small>
        Rychlost připsání se liší podle banky a platební metody. Pokud se
        částka v uvedené lhůtě neobjeví, stačí odpovědět na tento e-mail.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const PaymentRefundedEmail = (props: PaymentRefundedEmailProps) => (
  <PaymentRefundedEmailComponent {...props} />
)

// Mock data for preview/development
const mockPaymentRefunded: PaymentRefundedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  refundAmount: "1 250 Kč",
  originalPaymentAmount: "2 450 Kč",
  refundReason: "Částečné vrácení zboží",
  refundMethod: "Původní platební metoda",
  estimatedRefundTime: "3-5 pracovních dnů",
  orderLink: "https://keramickazahrada.cz/orders/12345"
}

export default () => <PaymentRefundedEmailComponent {...mockPaymentRefunded} />
