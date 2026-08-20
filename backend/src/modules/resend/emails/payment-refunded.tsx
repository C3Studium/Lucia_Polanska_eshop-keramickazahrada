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

interface PaymentRefundedEmailProps {
  customerName?: string;
  orderNumber?: string;
  refundAmount?: string;
  originalPaymentAmount?: string;
  /** Only when somebody actually stated one — no fabricated default. */
  refundReason?: string;
  refundMethod?: string;
  /** Whole sentence — the subscriber sends „Peníze se obvykle vrátí do…". */
  estimatedRefundTime?: string;
  orderLink?: string;
}

/**
 * Důvod se vykreslí jen s reálnou hodnotou — vymyšlený výchozí důvod
 * („částečné vrácení zboží") by u plného refundu tvrdil něco jiného, než se
 * stalo. `estimatedRefundTime` je celá věta: dřívější interpolace do „objeví
 * do {…}" vyráběla rozbitou větu, protože subscriber posílá celé souvětí.
 */
function PaymentRefundedEmailComponent({
  customerName,
  orderNumber = "",
  refundAmount,
  originalPaymentAmount,
  refundReason,
  refundMethod = "Zpět na účet, ze kterého platba přišla",
  estimatedRefundTime = "Peníze by se na vašem účtu měly objevit do 3–5 pracovních dnů.",
  orderLink = "",
}: PaymentRefundedEmailProps) {
  const orderUrl = orderLink || storeLink()

  return (
    <EmailLayout
      preview={
        refundAmount
          ? `Vracíme vám ${refundAmount} za objednávku ${orderNumber}.`
          : `Vracíme vám platbu za objednávku ${orderNumber}.`
      }
    >
      <Eyebrow>Platba</Eyebrow>
      <EmailH1 accent="vracíme.">Platbu</EmailH1>

      <Greeting name={customerName} />
      <P>
        vrácení platby za vaši objednávku je zpracováno. Peníze se k vám
        vracejí stejnou cestou, jakou k nám přišly.
      </P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {refundReason ? (
        <LedgerRow label="Důvod vrácení" value={refundReason} />
      ) : null}
      <LedgerRow label="Způsob vrácení" value={refundMethod} />
      {originalPaymentAmount ? (
        <LedgerRow label="Původní částka" value={originalPaymentAmount} />
      ) : null}
      {refundAmount ? (
        <LedgerRow label="Vráceno" value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      <Note tone="olive">{estimatedRefundTime}</Note>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        Rychlost připsání se liší podle banky a platební metody. Pokud se
        částka v uvedené lhůtě neobjeví, stačí odpovědět na tento e-mail.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const PaymentRefundedEmail = (props: PaymentRefundedEmailProps) => (
  <PaymentRefundedEmailComponent {...props} />
)

// Mock data for preview/development
const mockPaymentRefunded: PaymentRefundedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  refundAmount: "1 250 Kč",
  originalPaymentAmount: "2 450 Kč",
  refundReason: "Částečné vrácení zboží",
  refundMethod: "Zpět na účet, ze kterého platba přišla",
  estimatedRefundTime: "Peníze se obvykle vrátí do několika pracovních dnů.",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed"
}

export default () => <PaymentRefundedEmailComponent {...mockPaymentRefunded} />
