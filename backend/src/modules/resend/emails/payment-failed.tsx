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

interface PaymentFailedEmailProps {
  customerName?: string;
  orderNumber?: string;
  paymentAmount?: string;
  failureReason?: string;
  retryLink?: string;
  supportEmail?: string;
}

function PaymentFailedEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  paymentAmount = "2 450 Kč",
  failureReason = "Nedostatečné finanční prostředky na kartě",
  retryLink = "https://keramickazahrada.cz/checkout/retry/12345",
  supportEmail = CONTACT_EMAIL
}: PaymentFailedEmailProps) {
  return (
    <EmailLayout preview={`Platba za objednávku ${orderNumber} bohužel neprošla.`}>
      <Eyebrow>Platba</Eyebrow>
      <EmailH1 accent="neprošla.">Platba</EmailH1>

      <Greeting name={customerName} />
      <P>
        platbu za vaši objednávku se nepodařilo dokončit. Nic není ztraceno —
        objednávka na vás počká a platbu můžete v klidu zopakovat.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Důvod" value={failureReason} />
      <LedgerRow label="Částka" value={paymentAmount} strong tone="danger" />
      <LedgerEnd />

      <Note tone="danger">
        Platba neproběhla — z vašeho účtu nebylo nic strženo.
      </Note>

      <ButtonRow>
        <EmailButton href={retryLink}>Zkusit platbu znovu</EmailButton>
      </ButtonRow>

      <P small>
        Pokud se platba nedaří opakovaně, napište nám na{" "}
        <Link
          href={`mailto:${supportEmail}`}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          {supportEmail}
        </Link>
        {" "}— společně to vyřešíme.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const PaymentFailedEmail = (props: PaymentFailedEmailProps) => (
  <PaymentFailedEmailComponent {...props} />
)

// Mock data for preview/development
const mockPaymentFailed: PaymentFailedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  paymentAmount: "2 450 Kč",
  failureReason: "Nedostatečné finanční prostředky na kartě",
  retryLink: "https://keramickazahrada.cz/checkout/retry/12345",
  supportEmail: "info@keramickazahrada.cz"
}

export default () => <PaymentFailedEmailComponent {...mockPaymentFailed} />
