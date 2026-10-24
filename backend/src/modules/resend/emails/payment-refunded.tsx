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
  PaidFor,
  Signature,
  type EmailLineItem,
} from "../components/email-ui"
import { storeLink } from "../../../lib/storefront-url"

interface PaymentRefundedEmailProps {
  customerName?: string;
  orderNumber?: string;
  refundAmount?: string;
  originalPaymentAmount?: string;
  /**
   * Co bylo v objednávce, které se vrácení týká (`lib/email-items`). Není to
   * výpis vráceného zboží — tahle refundace může být i částečná, a tvrdit
   * „vracíme tyhle kusy" by bylo víc, než co se opravdu ví. Říká, které
   * objednávky se peníze týkají.
   */
  paidFor?: EmailLineItem[] | null;
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
  paidFor,
}: PaymentRefundedEmailProps) {
  const orderUrl = orderLink || storeLink()

  return (
    <EmailLayout
      preview={
        refundAmount
          ? `Vracím vám ${refundAmount} za objednávku ${orderNumber}.`
          : `Vracím vám platbu za objednávku ${orderNumber}.`
      }
    >
      <Eyebrow>Platba</Eyebrow>
      <EmailH1 accent="vám vracím.">Platbu</EmailH1>

      <Greeting name={customerName} />
      <P>
        vrácení platby za vaši objednávku jsem zadala. Peníze se k vám vrací
        stejnou cestou, jakou ke mně přišly. Kdyby za tím bylo něco, co jsem
        mohla udělat lépe, budu ráda, když mi napíšete.
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

      {/* Které objednávky se peníze týkají. Nadpis mluví o objednávce, ne o
          vráceném zboží — tahle refundace může být částečná (výpis
          konkrétních vrácených kusů posílá modul reklamací ve svém e-mailu). */}
      <PaidFor items={paidFor} heading="Co bylo v objednávce" />

      <Note tone="olive">{estimatedRefundTime}</Note>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        Jak rychle se částka připíše, záleží na vaší bance a způsobu platby.
        Pokud se do uvedené lhůty neobjeví, napište mi na info@keramickazahrada.cz —
        podívám se na to.
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
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  paidFor: [
    {
      title: "Keramické pítko pro ptáky",
      subtitle: "Modrá glazura",
      quantity: 1,
      amount: "1 950 Kč",
      thumbnail:
        "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
    },
    { title: "Miska na mýdlo", quantity: 2, amount: "470 Kč" },
  ],
}

export default () => <PaymentRefundedEmailComponent {...mockPaymentRefunded} />
