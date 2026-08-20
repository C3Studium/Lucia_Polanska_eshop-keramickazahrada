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
import { storeLink } from "../../../lib/storefront-url"

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

/**
 * Původní termín, kompenzace a sledovací odkaz se vykreslí jen s reálnými
 * daty — výchozí hodnota, která slibuje kupón nebo termín, jenž nikdy nebyl
 * domluvený, by byla slibem, který nikdo nedal.
 */
function OrderDelayedEmailComponent({
  customerName,
  orderNumber = "",
  originalDeliveryDate,
  newDeliveryDate = "co nevidět",
  delayReason,
  compensationOffer,
  trackingLink,
  orderLink = "",
  supportEmail = CONTACT_EMAIL
}: OrderDelayedEmailProps) {
  const orderUrl = orderLink || storeLink()
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

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {originalDeliveryDate ? (
        <LedgerRow label="Původní termín" value={originalDeliveryDate} />
      ) : null}
      <LedgerRow label="Nový termín" value={newDeliveryDate} strong />
      {delayReason ? <LedgerRow label="Důvod" value={delayReason} /> : null}
      <LedgerEnd />

      <Note tone="clay">Za zdržení se vám omlouváme.</Note>

      {compensationOffer ? (
        <P>
          Jako poděkování za trpělivost jsme pro vás připravili:{" "}
          {compensationOffer}.
        </P>
      ) : null}

      <ButtonRow>
        {trackingLink ? (
          <>
            <EmailButton href={trackingLink}>Sledovat objednávku</EmailButton>
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
  originalDeliveryDate: "15. 10. 2026",
  newDeliveryDate: "22. 10. 2026",
  delayReason: "Ruční výroba si vyžádala více času",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  supportEmail: "info@keramickazahrada.cz"
}

export default () => <OrderDelayedEmailComponent {...mockOrderDelayed} />
