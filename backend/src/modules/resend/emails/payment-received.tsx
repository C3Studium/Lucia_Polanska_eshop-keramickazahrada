import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  P,
  Signature,
} from "../components/email-ui"

interface PaymentReceivedEmailProps {
  customerName?: string;
  orderNumber?: string;
  paymentAmount?: string;
  paymentMethod?: string;
  orderLink?: string;
}

function PaymentReceivedEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  paymentAmount = "2 450 Kč",
  paymentMethod = "Kreditní karta",
  orderLink = "https://keramickazahrada.cz"
}: PaymentReceivedEmailProps) {
  return (
    <EmailLayout preview={`Platbu za objednávku ${orderNumber} jsme v pořádku přijali.`}>
      <Eyebrow>Platba</Eyebrow>
      <EmailH1 accent="přijata.">Platba</EmailH1>

      <Greeting name={customerName} />
      <P>
        platbu za vaši objednávku jsme v pořádku přijali. Objekty teď
        připravíme na cestu — jakmile zásilku předáme dopravci, pošleme
        další zprávu.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Způsob platby" value={paymentMethod} />
      <LedgerRow label="Částka" value={paymentAmount} strong tone="olive" />
      <LedgerEnd />

      <ButtonRow>
        <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton>
      </ButtonRow>

      <P small>
        Stav objednávky můžete kdykoli sledovat ve svém účtu na našem webu.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const PaymentReceivedEmail = (props: PaymentReceivedEmailProps) => (
  <PaymentReceivedEmailComponent {...props} />
)

// Mock data for preview/development
const mockPaymentReceived: PaymentReceivedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  paymentAmount: "2 450 Kč",
  paymentMethod: "Kreditní karta",
  orderLink: "https://keramickazahrada.cz/objednavka/12345"
}

export default () => <PaymentReceivedEmailComponent {...mockPaymentReceived} />
