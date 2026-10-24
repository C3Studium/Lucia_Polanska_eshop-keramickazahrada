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
  PaidFor,
  Signature,
  type EmailLineItem,
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
  /**
   * Týž košík vrácení s fotkami (`lib/email-items.refundEmailLineItems`).
   * Když přijde, nahradí textový řádek „Vrácené položky" — fotka řekne víc
   * než název. Starší e-maily ve frontě ho nemají a vykreslí se jako dřív.
   */
  paidFor?: EmailLineItem[] | null;
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
  paidFor,
  creditNoteNumber,
  creditNoteUrl,
  creditNoteNote,
  orderLink = ""
}: OrderRefundedEmailProps) {
  const vypisSFotkami = Boolean(paidFor?.length)
  const manual = Boolean(refundMethod && !/comgate|kart/i.test(refundMethod))
  return (
    <EmailLayout preview={`Peníze za objednávku ${orderNumber} jsou na cestě zpět k vám.`}>
      <Eyebrow>Objednávka</Eyebrow>
      <EmailH1 accent="na cestě zpět.">Peníze</EmailH1>

      <Greeting name={customerName} />
      <P>
        {manual
          ? "peníze za vaši objednávku vám vracím ručně — převodem na účet, nebo hotově."
          : "peníze za vaši objednávku jsem odeslala zpět. Vrací se k vám stejnou cestou, jakou ke mně přišly."}
      </P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {refundReason ? (
        <LedgerRow label="Důvod vrácení" value={refundReason} />
      ) : null}
      {/* Textový výpis jen tam, kde fotky nejsou (starší e-maily ve frontě) —
          jinak by stejné položky stály v e-mailu dvakrát. */}
      {refundLines && !vypisSFotkami ? (
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

      {/* Za co peníze vracíme — košík vrácení s fotkami. */}
      <PaidFor items={paidFor} heading="Za co vracíme peníze" />

      <Note tone="olive">
        {manual
          ? "Pokud od vás budu potřebovat číslo účtu, ozvu se e-mailem."
          : "Na účtu je uvidíte zpravidla do 3–5 pracovních dnů."}
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
        {manual ? "" : "Přesná doba připsání záleží na vaší bance. "}
        {creditNoteNote ? `${creditNoteNote} ` : ""}
        Kdyby cokoli, napište mi na info@keramickazahrada.cz — odpovídám sama.
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
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  paidFor: [
    {
      title: "Keramické pítko pro ptáky",
      subtitle: "Modrá glazura",
      quantity: 1,
      amount: "1 160 Kč",
      thumbnail:
        "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
    },
    { title: "Poštovné", amount: "90 Kč", service: true },
  ],
}

export default () => <OrderRefundedEmailComponent {...mockOrderRefunded} />
