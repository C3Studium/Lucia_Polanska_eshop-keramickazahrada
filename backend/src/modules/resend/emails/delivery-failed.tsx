import { Link, Section } from "@react-email/components"
import {
  brand,
  ButtonRow,
  CONTACT_EMAIL,
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

interface DeliveryFailedEmailProps {
  customerName?: string;
  orderNumber?: string;
  trackingNumber?: string;
  carrierName?: string;
  failureReason?: string;
  nextAttemptDate?: string;
  pickupLocation?: string;
  pickupAddress?: string;
  pickupHours?: string;
  trackingLink?: string;
  orderLink?: string;
  supportEmail?: string;
}

function DeliveryFailedEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  trackingNumber = "CZ123456789",
  carrierName = "Česká pošta",
  failureReason = "Nikdo nebyl doma během doručovací doby",
  nextAttemptDate = "Zítra mezi 9:00–17:00",
  pickupLocation = "Pošta Praha 1",
  pickupAddress = "Jindřišská 909/16, Praha 1",
  pickupHours = "Po–Pá: 8:00–18:00, So: 8:00–12:00",
  trackingLink = "https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=CZ123456789",
  orderLink = "https://keramickazahrada.cz/orders/12345",
  supportEmail = CONTACT_EMAIL,
}: DeliveryFailedEmailProps) {
  return (
    <EmailLayout
      preview={`Zásilku s objednávkou ${orderNumber} se nepodařilo doručit — čeká u dopravce.`}
    >
      <Eyebrow>Zásilka</Eyebrow>
      <EmailH1 accent="se nezdařilo.">Doručení</EmailH1>

      <Greeting name={customerName} />
      <P>
        dopravci se bohužel nepodařilo doručit zásilku s vašimi objekty.
        Kouskům se nic nestalo — jen teď čekají u dopravce na další krok.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Zásilka" value={trackingNumber} />
      <LedgerRow label="Dopravce" value={carrierName} />
      <LedgerRow label="Důvod" value={failureReason} />
      <LedgerRow label="Další pokus" value={nextAttemptDate} strong tone="clay" />
      <LedgerEnd />

      <Section style={{ margin: "28px 0 0" }}>
        <Eyebrow>Vyzvednutí</Eyebrow>
        <LedgerRow label="Místo" value={pickupLocation} />
        <LedgerRow label="Adresa" value={pickupAddress} />
        <LedgerRow label="Otevírací doba" value={pickupHours} />
        <LedgerEnd />
      </Section>

      <Note tone="clay">
        Zásilka na vás u dopravce počká jen omezenou dobu — nevyzvednutá se
        vrátí zpět do ateliéru.
      </Note>

      <ButtonRow>
        <EmailButton href={trackingLink}>Sledovat zásilku</EmailButton>
        <span style={{ display: "inline-block", width: "12px" }} />
        <EmailButton href={orderLink} variant="ghost">
          Zobrazit objednávku
        </EmailButton>
      </ButtonRow>

      <P small>
        Nový termín doručení nebo změnu adresy si můžete domluvit přímo u
        dopravce. A pokud si nebudete vědět rady, napište nám na{" "}
        <Link
          href={`mailto:${supportEmail}`}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          {supportEmail}
        </Link>{" "}
        — rádi pomůžeme.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const DeliveryFailedEmail = (props: DeliveryFailedEmailProps) => (
  <DeliveryFailedEmailComponent {...props} />
)

// Mock data for preview/development
const mockDeliveryFailed: DeliveryFailedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  trackingNumber: "CZ123456789",
  carrierName: "Česká pošta",
  failureReason: "Nikdo nebyl doma během doručovací doby",
  nextAttemptDate: "Zítra mezi 9:00–17:00",
  pickupLocation: "Pošta Praha 1",
  pickupAddress: "Jindřišská 909/16, Praha 1",
  pickupHours: "Po–Pá: 8:00–18:00, So: 8:00–12:00",
  trackingLink: "https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=CZ123456789",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  supportEmail: CONTACT_EMAIL,
}

export default () => <DeliveryFailedEmailComponent {...mockDeliveryFailed} />
