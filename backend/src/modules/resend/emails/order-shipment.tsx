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
import { CarrierDamageWarning } from "../components/carrier-damage"
import { storeLink } from "../../../lib/storefront-url"

interface OrderShipmentEmailProps {
  customerName?: string;
  orderNumber?: string;
  trackingNumber?: string;
  carrierName?: string;
  /** Only when somebody actually promised one — no fabricated estimate. */
  estimatedDelivery?: string;
  trackingLink?: string;
  orderLink?: string;
}

/**
 * Sledování, dopravce i odhad doručení se vykreslí jen s reálnými daty —
 * dřívější výchozí hodnoty („CZ123456789", „2-3 pracovní dny") by v ostrém
 * e-mailu tvrdily číslo zásilky a termín, které nikdo neslíbil.
 */
function OrderShipmentEmailComponent({
  customerName,
  orderNumber = "",
  trackingNumber,
  carrierName,
  estimatedDelivery,
  trackingLink = "",
  orderLink = ""
}: OrderShipmentEmailProps) {
  // Subscriber may pass empty strings when the carrier runs in record-only
  // mode — then the e-mail goes without the tracking row and button.
  const hasTracking = Boolean(trackingLink)
  const orderUrl = orderLink || storeLink()

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

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {carrierName ? <LedgerRow label="Dopravce" value={carrierName} /> : null}
      {trackingNumber ? (
        <LedgerRow label="Číslo zásilky" value={trackingNumber} strong />
      ) : null}
      {estimatedDelivery ? (
        <LedgerRow label="Odhad doručení" value={estimatedDelivery} />
      ) : null}
      <LedgerEnd />

      <Note tone="olive">Křehké objekty cestují v ochranném balení.</Note>

      {/* The ninety seconds at the door decide who pays for a broken pot. This is the
          last thing they read before that moment. */}
      <CarrierDamageWarning />

      <ButtonRow>
        {hasTracking ? (
          <>
            <EmailButton href={trackingLink}>Sledovat zásilku</EmailButton>
            {orderUrl ? (
              <>
                <span style={{ display: "inline-block", width: "12px" }} />
                <EmailButton href={orderUrl} variant="ghost">
                  Zobrazit objednávku
                </EmailButton>
              </>
            ) : null}
          </>
        ) : orderUrl ? (
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        ) : null}
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
