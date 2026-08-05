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

interface OrderReadyPickupEmailProps {
  customerName?: string;
  orderNumber?: string;
  pickupLocation?: string;
  pickupAddress?: string;
  pickupHours?: string;
  readyDate?: string;
  pickupDeadline?: string;
  orderLink?: string;
  pickupInstructions?: string;
}

function OrderReadyPickupEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  pickupLocation = "Prodejna Praha",
  pickupAddress = "Václavské náměstí 123, Praha 1",
  pickupHours = "Po-Pá: 9:00-18:00, So: 10:00-16:00",
  readyDate = new Date().toLocaleDateString('cs-CZ'),
  pickupDeadline = "14 dní od připravenosti",
  orderLink = "https://keramickazahrada.cz/orders/12345",
  pickupInstructions = "Při vyzvednutí si vezměte občanský průkaz a číslo objednávky"
}: OrderReadyPickupEmailProps) {
  return (
    <EmailLayout
      preview={`Objednávka ${orderNumber} je zabalená a připravená k vyzvednutí.`}
    >
      <Eyebrow>Osobní odběr</Eyebrow>
      <EmailH1 accent="k vyzvednutí.">Připraveno</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaše objednávka {orderNumber} je zabalená a čeká na vás. Vše potřebné
        k vyzvednutí najdete níže.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Místo" value={pickupLocation} strong />
      <LedgerRow label="Adresa" value={pickupAddress} />
      <LedgerRow label="Otevírací doba" value={pickupHours} />
      <LedgerRow label="Připraveno od" value={readyDate} />
      <LedgerRow label="Vyzvednout do" value={pickupDeadline} tone="clay" />
      <LedgerEnd />

      <Note tone="olive">Objednávka na vás čeká.</Note>

      <ButtonRow>
        <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton>
      </ButtonRow>

      <P small>
        {pickupInstructions}. Pokud se vám vyzvednutí do uvedeného termínu
        nehodí, dejte nám prosím vědět — domluvíme se.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const OrderReadyPickupEmail = (props: OrderReadyPickupEmailProps) => (
  <OrderReadyPickupEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderReadyPickup: OrderReadyPickupEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  pickupLocation: "Prodejna Praha",
  pickupAddress: "Václavské náměstí 123, Praha 1",
  pickupHours: "Po-Pá: 9:00-18:00, So: 10:00-16:00",
  readyDate: new Date().toLocaleDateString('cs-CZ'),
  pickupDeadline: "14 dní od připravenosti",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  pickupInstructions: "Při vyzvednutí si vezměte občanský průkaz a číslo objednávky"
}

export default () => <OrderReadyPickupEmailComponent {...mockOrderReadyPickup} />
