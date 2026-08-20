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
  /** Only when somebody actually stated one — no fabricated default. */
  refundReason?: string;
  orderLink?: string;
}

/**
 * Důvod a částka se vykreslí jen s reálnými daty — vymyšlená výchozí částka
 * („1 250 Kč") by v ostrém e-mailu slibovala jiné peníze, než se vracejí.
 */
function OrderRefundedEmailComponent({
  customerName,
  orderNumber = "",
  refundAmount,
  refundReason,
  orderLink = ""
}: OrderRefundedEmailProps) {
  return (
    <EmailLayout preview={`Vrácení peněz za objednávku ${orderNumber} je zpracováno.`}>
      <Eyebrow>Objednávka</Eyebrow>
      <EmailH1 accent="na cestě zpět.">Peníze</EmailH1>

      <Greeting name={customerName} />
      <P>
        vrácení peněz za vaši objednávku jsme zpracovali. Částka se
        k vám vrací stejnou cestou, jakou k nám přišla.
      </P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {refundReason ? (
        <LedgerRow label="Důvod vrácení" value={refundReason} />
      ) : null}
      {refundAmount ? (
        <LedgerRow label="Částka" value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      <Note tone="olive">
        Peníze se na vašem účtu objeví zpravidla do 3–5 pracovních dnů.
      </Note>

      {orderLink ? (
        <ButtonRow>
          <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

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
  refundReason: "Vrácení rozdílu po úpravě objednávky",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed"
}

export default () => <OrderRefundedEmailComponent {...mockOrderRefunded} />
