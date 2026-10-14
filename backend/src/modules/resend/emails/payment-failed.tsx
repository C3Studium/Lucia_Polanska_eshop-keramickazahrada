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
  /** Only when the payment provider actually said one — no guessed default. */
  failureReason?: string;
  retryLink?: string;
  supportEmail?: string;
  /**
   * Platba z pokladny — objednávka ještě nevznikla (bez čísla), odkaz obnoví
   * košík a vede na krok platby. Bez toho jde o objednávku nebo doplatek.
   */
  checkout?: boolean;
}

/**
 * Důvod, částka i tlačítko se vykreslí jen s reálnými daty — vymyšlený
 * výchozí důvod („nedostatečné prostředky") by obviňoval kartu zákazníka
 * za něco, co se třeba vůbec nestalo.
 */
function PaymentFailedEmailComponent({
  customerName,
  orderNumber = "",
  paymentAmount,
  failureReason,
  retryLink = "",
  supportEmail = CONTACT_EMAIL,
  checkout = false,
}: PaymentFailedEmailProps) {
  return (
    <EmailLayout
      preview={
        checkout
          ? "Platba bohužel neprošla — košík vám zůstal uložený."
          : `Platba za objednávku ${orderNumber} bohužel neprošla.`
      }
    >
      <Eyebrow>Platba</Eyebrow>
      <EmailH1 accent="neprošla.">Platba</EmailH1>

      <Greeting name={customerName} />
      {checkout ? (
        <P>
          platbu se nepodařilo dokončit, a tak objednávka zatím nevznikla.
          Košík vám zůstal uložený — stačí se vrátit a platbu zopakovat.
        </P>
      ) : (
        <P>
          platbu za vaši objednávku se nepodařilo dokončit. Nic není ztraceno —
          objednávka na vás počká a platbu můžete v klidu zopakovat.
        </P>
      )}

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {failureReason ? <LedgerRow label="Důvod" value={failureReason} /> : null}
      {paymentAmount ? (
        <LedgerRow label="Částka" value={paymentAmount} strong tone="danger" />
      ) : null}
      <LedgerEnd />

      <Note tone="danger">
        Platba neproběhla — z vašeho účtu nebylo nic strženo.
      </Note>

      {retryLink ? (
        <ButtonRow>
          <EmailButton href={retryLink}>
            {checkout ? "Dokončit objednávku" : "Zkusit platbu znovu"}
          </EmailButton>
        </ButtonRow>
      ) : null}

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
