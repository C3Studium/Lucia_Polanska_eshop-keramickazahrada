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
import { storeLink } from "../../../lib/storefront-url"

/**
 * „Prosíme o doplatek" — the balance-payment request for a commission.
 *
 * The one send site is `made-to-order.balance-requested`
 * (subscribers/customer-emails.ts): the customer paid a deposit, the owner
 * asks for the rest. The copy used to claim „vaši platbu zpracováváme — není
 * třeba nic dělat", the exact opposite of what the moment needs; the ONE thing
 * this mail wants is the payment click, so the link is the headline act.
 *
 * `paymentLink` is the signed balance link (works from any inbox, no account);
 * `orderLink` stays accepted because older queued notifications carried the
 * payment URL under that name.
 */
interface PaymentPendingEmailProps {
  /** The newest shared making-of photo — turns the payment ask into „podívejte se". */
  makingPhotoUrl?: string | null
  customerName?: string;
  orderNumber?: string;
  paymentAmount?: string;
  paymentMethod?: string;
  /** Signed payment link — the button. */
  paymentLink?: string;
  /** Legacy alias: previous callers sent the payment URL as `orderLink`. */
  orderLink?: string;
  /** Whole sentence, e.g. „Platba se obvykle potvrdí do několika minut." */
  estimatedConfirmationTime?: string;
}

function PaymentPendingEmailComponent({
  customerName,
  orderNumber = "",
  paymentAmount,
  paymentMethod = "Platební karta nebo převod",
  paymentLink = "",
  orderLink = "",
  estimatedConfirmationTime = "Platba se obvykle potvrdí do několika minut.",
  makingPhotoUrl,
}: PaymentPendingEmailProps) {
  const payUrl = paymentLink || orderLink || storeLink()

  return (
    <EmailLayout
      preview={
        paymentAmount
          ? `Zbývá doplatek ${paymentAmount} za vaši zakázku — zaplatíte jedním kliknutím.`
          : "Zbývá doplatek za vaši zakázku — zaplatíte jedním kliknutím."
      }
    >
      <Eyebrow>Zakázková výroba</Eyebrow>
      <EmailH1 accent="o doplatek.">Prosíme</EmailH1>

      <Greeting name={customerName} />
      <P>
        posíláme odkaz k zaplacení doplatku za vaši zakázku
        {orderNumber ? ` ${orderNumber}` : ""}. Zaplatit můžete kartou nebo
        převodem — stačí jedno kliknutí na tlačítko níže.
      </P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      <LedgerRow label="Způsob platby" value={paymentMethod} />
      {paymentAmount ? (
        <LedgerRow label="Zbývá doplatit" value={paymentAmount} strong tone="clay" />
      ) : null}
      <LedgerEnd />

      {makingPhotoUrl && (
        <>
          <P small style={{ margin: "24px 0 8px" }}>
            Takhle vaše zakázka právě vypadá:
          </P>
          <img
            src={makingPhotoUrl}
            alt="Vaše zakázka"
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

      {payUrl ? (
        <ButtonRow>
          <EmailButton href={payUrl}>
            {paymentAmount ? `Zaplatit ${paymentAmount}` : "Zaplatit doplatek"}
          </EmailButton>
        </ButtonRow>
      ) : null}

      <Note tone="olive">
        Jakmile doplatek dorazí, potvrdíme vám ho e-mailem a domluvíme se
        na předání.
      </Note>

      <P small>
        {estimatedConfirmationTime} Kdyby vám odkaz nefungoval nebo jste si
        s čímkoli nevěděli rady, stačí odpovědět na tento e-mail.
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
  paymentMethod: "Platební karta nebo převod",
  paymentLink: "https://keramickazahrada.cz/cz/order/order_12345/pay-balance?token=abc",
  makingPhotoUrl:
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
  estimatedConfirmationTime: "Platba se obvykle potvrdí do několika minut.",
}

export default () => <PaymentPendingEmailComponent {...mockPaymentPending} />
