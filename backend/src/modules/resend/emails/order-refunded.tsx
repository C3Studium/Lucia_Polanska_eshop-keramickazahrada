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

interface OrderRefundedEmailProps {
  customerName?: string;
  orderNumber?: string;
  refundAmount?: string;
  refundReason?: string;
  orderLink?: string;
}

function OrderRefundedEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  refundAmount = "1 250 Kč",
  refundReason = "Požadavek zákazníka",
  orderLink = "https://keramickazahrada.cz/orders/12345"
}: OrderRefundedEmailProps) {
  return (
    <EmailLayout preview={`Vrácení peněz za objednávku ${orderNumber} je zpracováno.`}>
      <Eyebrow>Objednávka</Eyebrow>
      <EmailH1 accent="na cestě zpět.">Peníze</EmailH1>

      <Greeting name={customerName} />
      <P>
        žádost o vrácení peněz za vaši objednávku jsme zpracovali. Částka se
        k vám vrací stejnou cestou, jakou k nám přišla.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Důvod vrácení" value={refundReason} />
      <LedgerRow label="Částka" value={refundAmount} strong tone="olive" />
      <LedgerEnd />

      <Note tone="olive">
        Peníze se na vašem účtu objeví zpravidla do 3–5 pracovních dnů.
      </Note>

      <ButtonRow>
        <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton>
      </ButtonRow>

      <P small>
        Přesná doba připsání závisí na vaší bance. Máte-li jakýkoli dotaz,
        stačí odpovědět na tento e-mail.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const OrderRefundedEmail = (props: OrderRefundedEmailProps) => (
  <OrderRefundedEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderRefunded: OrderRefundedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  refundAmount: "1 250 Kč",
  refundReason: "Požadavek zákazníka",
  orderLink: "https://keramickazahrada.cz/orders/12345"
}

export default () => <OrderRefundedEmailComponent {...mockOrderRefunded} />
