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
import { storeLink } from "../../../lib/storefront-url"

interface PaymentReceivedEmailProps {
  customerName?: string;
  orderNumber?: string;
  paymentAmount?: string;
  paymentMethod?: string;
  orderLink?: string;
}

/**
 * Řádky se vykreslí jen s reálnými daty — vymyšlená výchozí částka by
 * v ostrém e-mailu potvrzovala jiné peníze, než dorazily.
 */
function PaymentReceivedEmailComponent({
  customerName,
  orderNumber = "",
  paymentAmount,
  paymentMethod,
  orderLink = ""
}: PaymentReceivedEmailProps) {
  const orderUrl = orderLink || storeLink()

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

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {paymentMethod ? (
        <LedgerRow label="Způsob platby" value={paymentMethod} />
      ) : null}
      {paymentAmount ? (
        <LedgerRow label="Částka" value={paymentAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

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
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed"
}

export default () => <PaymentReceivedEmailComponent {...mockPaymentReceived} />
