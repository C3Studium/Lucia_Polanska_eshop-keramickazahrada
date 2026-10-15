import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  MultiLine,
  Note,
  P,
  Signature,
} from "../components/email-ui"

interface OrderRefundedEmailProps {
  customerName?: string;
  orderNumber?: string;
  refundAmount?: string;
  /** Only when somebody actually stated one — no fabricated default. */
  refundReason?: string;
  /** „stejnou cestou, jakou jste platili (přes ComGate) — na účtu do 3–5 pracovních dnů" / „ručně" (§13.3). */
  refundMethod?: string;
  /** Košík vrácení (§13.2) — řádek za řádek („název · N ks · částka"). */
  refundLines?: string;
  /** Dobropis (§13.3): číslo + odkaz na PDF, nebo věta, proč zatím není. */
  creditNoteNumber?: string;
  creditNoteUrl?: string;
  creditNoteNote?: string;
  orderLink?: string;
}

/**
 * Důvod a částka se vykreslí jen s reálnými daty — vymyšlená výchozí částka
 * („1 250 Kč") by v ostrém e-mailu slibovala jiné peníze, než se vracejí.
 * Věta o připsání se řídí způsobem: u karty lhůta banky, u ručního vrácení
 * žádný slib „do 3–5 dnů" (ten by u převodu, který majitelka teprve zadá,
 * byl lež). Bez `refundMethod` (starší volající) zůstává původní text.
 */
function OrderRefundedEmailComponent({
  customerName,
  orderNumber = "",
  refundAmount,
  refundReason,
  refundMethod,
  refundLines,
  creditNoteNumber,
  creditNoteUrl,
  creditNoteNote,
  orderLink = ""
}: OrderRefundedEmailProps) {
  const manual = Boolean(refundMethod && !/comgate|kart/i.test(refundMethod))
  return (
    <EmailLayout preview={`Vrácení peněz za objednávku ${orderNumber} je zpracováno.`}>
      <Eyebrow>Objednávka</Eyebrow>
      <EmailH1 accent="na cestě zpět.">Peníze</EmailH1>

      <Greeting name={customerName} />
      <P>
        {manual
          ? "vrácení peněz za vaši objednávku jsme zpracovali. Částku vám vracíme ručně — převodem na účet, nebo hotově."
          : "vrácení peněz za vaši objednávku jsme zpracovali. Částka se k vám vrací stejnou cestou, jakou k nám přišla."}
      </P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {refundReason ? (
        <LedgerRow label="Důvod vrácení" value={refundReason} />
      ) : null}
      {refundLines ? (
        <LedgerRow label="Vrácené položky" value={<MultiLine value={refundLines} />} />
      ) : null}
      {refundAmount ? (
        <LedgerRow label="Částka" value={refundAmount} strong tone="olive" />
      ) : null}
      {refundMethod ? <LedgerRow label="Způsob" value={refundMethod} /> : null}
      {creditNoteNumber ? (
        <LedgerRow label="Dobropis" value={`č. ${creditNoteNumber}`} />
      ) : null}
      <LedgerEnd />

      <Note tone="olive">
        {manual
          ? "Pokud od vás potřebujeme číslo účtu, ozveme se e-mailem."
          : "Peníze se na vašem účtu objeví zpravidla do 3–5 pracovních dnů."}
      </Note>

      {orderLink || creditNoteUrl ? (
        <ButtonRow>
          {orderLink ? <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton> : null}
          {creditNoteUrl ? (
            <>
              {orderLink ? <span style={{ display: "inline-block", width: "12px" }} /> : null}
              <EmailButton href={creditNoteUrl} variant={orderLink ? "ghost" : undefined}>
                Dobropis (PDF)
              </EmailButton>
            </>
          ) : null}
        </ButtonRow>
      ) : null}

      <P small>
        {manual ? "" : "Přesná doba připsání závisí na vaší bance. "}
        {creditNoteNote ? `${creditNoteNote} ` : ""}
        Máte-li jakýkoli dotaz, stačí odpovědět na tento e-mail.
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const OrderRefundedEmail = (props: OrderRefundedEmailProps) => (
  <OrderRefundedEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderRefunded: OrderRefundedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  refundAmount: "1 250 Kč",
  refundReason: "Vrácení rozdílu po úpravě objednávky",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed"
}

export default () => <OrderRefundedEmailComponent {...mockOrderRefunded} />
