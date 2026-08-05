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

interface PaymentCancelledEmailProps {
  customerName?: string;
  orderNumber?: string;
  paymentAmount?: string;
  cancellationReason?: string;
  orderLink?: string;
  retryLink?: string;
}

function PaymentCancelledEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  paymentAmount = "2 450 Kč",
  cancellationReason = "Zrušeno zákazníkem",
  orderLink = "https://keramickazahrada.cz/orders/12345",
  retryLink = "https://keramickazahrada.cz/checkout/retry/12345",
}: PaymentCancelledEmailProps) {
  return (
    <EmailLayout
      preview={`Platba za objednávku ${orderNumber} byla zrušena — objednávka zůstává nedokončená.`}
    >
      <Eyebrow>Platba</Eyebrow>
      <EmailH1 accent="zrušena.">Platba</EmailH1>

      <Greeting name={customerName} />
      <P>
        platba za vaši objednávku byla zrušena a objednávka se tak
        nedokončila. Nic dalšího se nestalo — objekty zůstávají ve vašem
        košíku a nákup můžete kdykoli dokončit.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Důvod zrušení" value={cancellationReason} />
      <LedgerRow label="Částka" value={paymentAmount} strong />
      <LedgerEnd />

      <Note tone="clay">
        Objednávka zatím zůstává nedokončená — kousky na vás počkají v košíku.
      </Note>

      <ButtonRow>
        <EmailButton href={retryLink}>Dokončit objednávku</EmailButton>
        <span style={{ display: "inline-block", width: "12px" }} />
        <EmailButton href={orderLink} variant="ghost">
          Zobrazit objednávku
        </EmailButton>
      </ButtonRow>

      <P small>
        Pokud jste platbu zrušili záměrně, nemusíte dělat nic. Byla-li vám
        částka na účtu dočasně blokována, banka ji sama uvolní, obvykle do
        několika dnů.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const PaymentCancelledEmail = (props: PaymentCancelledEmailProps) => (
  <PaymentCancelledEmailComponent {...props} />
)

// Mock data for preview/development
const mockPaymentCancelled: PaymentCancelledEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  paymentAmount: "2 450 Kč",
  cancellationReason: "Zrušeno zákazníkem",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  retryLink: "https://keramickazahrada.cz/checkout/retry/12345",
}

export default () => <PaymentCancelledEmailComponent {...mockPaymentCancelled} />
