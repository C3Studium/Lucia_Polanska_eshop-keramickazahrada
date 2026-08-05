import { Link } from "@react-email/components"
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

interface OrderDelayedEmailProps {
  customerName?: string;
  orderNumber?: string;
  originalDeliveryDate?: string;
  newDeliveryDate?: string;
  delayReason?: string;
  compensationOffer?: string;
  trackingLink?: string;
  orderLink?: string;
  supportEmail?: string;
}

function OrderDelayedEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  originalDeliveryDate = "15. října 2025",
  newDeliveryDate = "22. října 2025",
  delayReason = "Ruční výroba si vyžádala více času",
  compensationOffer = "Slevový kupón ve výši 10 % na další nákup",
  trackingLink = "https://keramickazahrada.cz/orders/12345/track",
  orderLink = "https://keramickazahrada.cz/orders/12345",
  supportEmail = CONTACT_EMAIL
}: OrderDelayedEmailProps) {
  return (
    <EmailLayout
      preview={`Objednávka ${orderNumber} se zdrží — omlouváme se a děkujeme za trpělivost.`}
    >
      <Eyebrow>Objednávka {orderNumber}</Eyebrow>
      <EmailH1 accent="zdrží.">Objednávka se</EmailH1>

      <Greeting name={customerName} />
      <P>
        musíme vás poprosit o strpení — vaše objednávka se zdrží. Ruční výroba
        má vlastní rytmus a někdy si vyžádá víc času, než jsme čekali. Níže
        najdete nový termín.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Původní termín" value={originalDeliveryDate} />
      <LedgerRow label="Nový termín" value={newDeliveryDate} strong />
      <LedgerRow label="Důvod" value={delayReason} />
      <LedgerEnd />

      <Note tone="clay">Za zdržení se vám omlouváme.</Note>

      <P>
        Jako poděkování za trpělivost jsme pro vás připravili:{" "}
        {compensationOffer}.
      </P>
      <P small>
        Kupón vám po doručení objednávky automaticky přidáme do účtu.
      </P>

      <ButtonRow>
        <EmailButton href={trackingLink}>Sledovat objednávku</EmailButton>
        <span style={{ display: "inline-block", width: "12px" }} />
        <EmailButton href={orderLink} variant="ghost">
          Zobrazit objednávku
        </EmailButton>
      </ButtonRow>

      <P small>
        Máte-li jakýkoli dotaz, napište nám na{" "}
        <Link
          href={`mailto:${supportEmail}`}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          {supportEmail}
        </Link>
        .
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const OrderDelayedEmail = (props: OrderDelayedEmailProps) => (
  <OrderDelayedEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderDelayed: OrderDelayedEmailProps = {
  customerName: "Marie Svobodová",
  orderNumber: "#12345",
  originalDeliveryDate: "15. října 2025",
  newDeliveryDate: "22. října 2025",
  delayReason: "Ruční výroba si vyžádala více času",
  compensationOffer: "Slevový kupón ve výši 10 % na další nákup",
  trackingLink: "https://keramickazahrada.cz/orders/12345/track",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  supportEmail: "info@keramickazahrada.cz"
}

export default () => <OrderDelayedEmailComponent {...mockOrderDelayed} />
