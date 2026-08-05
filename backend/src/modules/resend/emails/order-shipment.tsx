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

interface OrderShipmentEmailProps {
  customerName?: string;
  orderNumber?: string;
  trackingNumber?: string;
  carrierName?: string;
  estimatedDelivery?: string;
  trackingLink?: string;
  orderLink?: string;
}

function OrderShipmentEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  trackingNumber = "CZ123456789",
  carrierName = "Česká pošta",
  estimatedDelivery = "2-3 pracovní dny",
  trackingLink = "https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=CZ123456789",
  orderLink = "https://keramickazahrada.cz/orders/12345"
}: OrderShipmentEmailProps) {
  // Subscriber may pass empty strings when the carrier runs in record-only
  // mode — then the e-mail goes without the tracking row and button.
  const hasTracking = Boolean(trackingLink)

  return (
    <EmailLayout
      preview={`Objednávku ${orderNumber} jsme předali dopravci — je na cestě k vám.`}
    >
      <Eyebrow>Zásilka</Eyebrow>
      <EmailH1 accent="na cestě.">Objednávka je</EmailH1>

      <Greeting name={customerName} />
      <P>
        objednávku {orderNumber} jsme předali dopravci. Každý kus balíme
        ručně, aby k vám dorazil tak, jak opustil ateliér.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Dopravce" value={carrierName} />
      {trackingNumber ? (
        <LedgerRow label="Číslo zásilky" value={trackingNumber} strong />
      ) : null}
      <LedgerRow label="Odhad doručení" value={estimatedDelivery} />
      <LedgerEnd />

      <Note tone="olive">Křehké objekty cestují v ochranném balení.</Note>

      <ButtonRow>
        {hasTracking ? (
          <>
            <EmailButton href={trackingLink}>Sledovat zásilku</EmailButton>
            <span style={{ display: "inline-block", width: "12px" }} />
            <EmailButton href={orderLink} variant="ghost">
              Zobrazit objednávku
            </EmailButton>
          </>
        ) : (
          <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton>
        )}
      </ButtonRow>

      <P small>
        O doručení vás bude dopravce informovat SMS nebo e-mailem. Pokud vás
        nezastihne, zásilku uloží k vyzvednutí.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const OrderShipmentEmail = (props: OrderShipmentEmailProps) => (
  <OrderShipmentEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderShipment: OrderShipmentEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  trackingNumber: "CZ123456789",
  carrierName: "Česká pošta",
  estimatedDelivery: "2-3 pracovní dny",
  trackingLink: "https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=CZ123456789",
  orderLink: "https://keramickazahrada.cz/orders/12345"
}

export default () => <OrderShipmentEmailComponent {...mockOrderShipment} />
