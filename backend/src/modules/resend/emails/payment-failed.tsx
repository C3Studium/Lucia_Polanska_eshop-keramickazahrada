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
  PaidFor,
  Signature,
  type EmailLineItem,
} from "../components/email-ui"

interface PaymentFailedEmailProps {
  customerName?: string;
  orderNumber?: string;
  paymentAmount?: string;
  /**
   * Čeho se nezdařená platba týkala — položky košíku nebo objednávky
   * (`lib/email-items`). Bez nich e-mail mluví o penězích a neřekne za co.
   */
  paidFor?: EmailLineItem[] | null;
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
  paidFor,
  failureReason,
  retryLink = "",
  supportEmail = CONTACT_EMAIL,
  checkout = false,
}: PaymentFailedEmailProps) {
  return (
    <EmailLayout
      preview={
        checkout
          ? "Platba neprošla — košík vám zůstal uložený, stačí ji zopakovat."
          : `Platba za objednávku ${orderNumber} neprošla — můžete ji v klidu zopakovat.`
      }
    >
      <Eyebrow>Platba</Eyebrow>
      <EmailH1 accent="neprošla.">Platba</EmailH1>

      <Greeting name={customerName} />
      {checkout ? (
        <P>
          platbu se nepodařilo dokončit, a tak objednávka zatím nevznikla.
          Nic se neděje — košík vám zůstal uložený, stačí se vrátit a platbu
          zopakovat.
        </P>
      ) : (
        <P>
          platbu za vaši objednávku se nepodařilo dokončit. Nic se neztratilo —
          objednávku vám podržím a platbu můžete zopakovat, až se vám to bude
          hodit.
        </P>
      )}

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {failureReason ? <LedgerRow label="Důvod" value={failureReason} /> : null}
      {paymentAmount ? (
        <LedgerRow label="Částka" value={paymentAmount} strong tone="danger" />
      ) : null}
      <LedgerEnd />

      {/* Čeho se platba týkala — u „neprošla" obzvlášť: zákazník má řešit
          peníze a bez výpisu neví za co. U pokladny je to obsah košíku,
          který mu odkaz obnoví. */}
      <PaidFor
        items={paidFor}
        heading={checkout ? "Co máte v košíku" : "Za co platba byla"}
      />

      <Note tone="danger">
        Z vašeho účtu se nic nestrhlo — platba vůbec neproběhla.
      </Note>

      {retryLink ? (
        <ButtonRow>
          <EmailButton href={retryLink}>
            {checkout ? "Dokončit objednávku" : "Zopakovat platbu"}
          </EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        Kdyby se platba nedařila ani napodruhé, napište mi na{" "}
        <Link
          href={`mailto:${supportEmail}`}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          {supportEmail}
        </Link>
        {" "}a vyřešíme to spolu.
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
  supportEmail: "info@keramickazahrada.cz",
  paidFor: [
    {
      title: "Keramické pítko pro ptáky",
      subtitle: "Modrá glazura",
      quantity: 1,
      amount: "1 950 Kč",
      thumbnail:
        "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
    },
    { title: "Balné — Keramické pítko pro ptáky", amount: "30 Kč", service: true },
  ],
}

export default () => <PaymentFailedEmailComponent {...mockPaymentFailed} />
