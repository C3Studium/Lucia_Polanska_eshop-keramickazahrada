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

interface PaymentPendingEmailProps {
  /** The newest shared making-of photo — turns the payment ask into „hotovo, podívejte se". */
  makingPhotoUrl?: string | null
  customerName?: string;
  orderNumber?: string;
  paymentAmount?: string;
  paymentMethod?: string;
  orderLink?: string;
  estimatedConfirmationTime?: string;
}

function PaymentPendingEmailComponent({
  customerName = "Vážený zákazník",
  orderNumber = "#12345",
  paymentAmount = "2 450 Kč",
  paymentMethod = "Bankovní převod",
  orderLink = "https://keramickazahrada.cz/orders/12345",
  estimatedConfirmationTime = "1-2 pracovní dny",
  makingPhotoUrl,
}: PaymentPendingEmailProps & { makingPhotoUrl?: string | null }) {
  return (
    <EmailLayout preview={`Platbu za objednávku ${orderNumber} právě zpracováváme.`}>
      <Eyebrow>Platba</Eyebrow>
      <EmailH1 accent="se zpracovává.">Platba</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaši platbu jsme zaznamenali a nyní čeká na potvrzení. Jakmile ji
        banka potvrdí, objednávku dokončíme a objekty připravíme na cestu.
      </P>

      <LedgerRow label="Objednávka" value={orderNumber} />
      <LedgerRow label="Způsob platby" value={paymentMethod} />
      <LedgerRow label="Očekávané potvrzení" value={estimatedConfirmationTime} />
      <LedgerRow label="Částka" value={paymentAmount} strong tone="clay" />
      <LedgerEnd />

      <Note tone="clay">
        Není třeba nic dělat — jakmile bude platba potvrzena, dáme vám vědět.
      </Note>

      {makingPhotoUrl && (
        <>
          <P small>Takhle vaše zakázka právě vypadá:</P>
          <img
            src={makingPhotoUrl}
            alt="Hotová zakázka"
            width="100%"
            style={{
              borderRadius: "8px",
              display: "block",
              marginBottom: "16px",
              maxWidth: "520px",
            }}
          />
        </>
      )}

      <ButtonRow>
        <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton>
      </ButtonRow>

      <P small>
        U některých platebních metod může potvrzení trvat o něco déle. O
        přijetí platby vás budeme informovat dalším e-mailem.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const PaymentPendingEmail = (props: PaymentPendingEmailProps) => (
  <PaymentPendingEmailComponent {...props} />
)

// Mock data for preview/development
const mockPaymentPending: PaymentPendingEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  paymentAmount: "2 450 Kč",
  paymentMethod: "Bankovní převod",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  estimatedConfirmationTime: "1-2 pracovní dny"
}

export default () => <PaymentPendingEmailComponent {...mockPaymentPending} />
