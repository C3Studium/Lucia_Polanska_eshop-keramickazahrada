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
import { useCopy, useEmailLocale } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

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

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: (order: string) => string
  eyebrow: string
  title: string
  accent: string
  introManual: string
  introGateway: string
  order: string
  reason: string
  lines: string
  amount: string
  method: string
  creditNote: string
  creditNoteNo: (number: string) => string
  paidForHeading: string
  noteManual: string
  noteGateway: string
  viewOrder: string
  creditNotePdf: string
  bankTiming: string
  contact: string
}> = {
  cs: {
    preview: (order) => `Peníze za objednávku ${order} jsou na cestě zpět k vám.`,
    eyebrow: "Objednávka",
    title: "Peníze",
    accent: "na cestě zpět.",
    introManual: "peníze za vaši objednávku vám vracím ručně — převodem na účet, nebo hotově.",
    introGateway:
      "peníze za vaši objednávku jsem odeslala zpět. Vrací se k vám stejnou cestou, jakou ke mně přišly.",
    order: "Objednávka",
    reason: "Důvod vrácení",
    lines: "Vrácené položky",
    amount: "Částka",
    method: "Způsob",
    creditNote: "Dobropis",
    creditNoteNo: (number) => `č. ${number}`,
    paidForHeading: "Za co vracíme peníze",
    noteManual: "Pokud od vás budu potřebovat číslo účtu, ozvu se e-mailem.",
    noteGateway: "Na účtu je uvidíte zpravidla do 3–5 pracovních dnů.",
    viewOrder: "Zobrazit objednávku",
    creditNotePdf: "Dobropis (PDF)",
    bankTiming: "Přesná doba připsání záleží na vaší bance. ",
    contact: "Kdyby cokoli, napište mi na info@keramickazahrada.cz — odpovídám sama.",
  },
  sk: {
    preview: (order) => `Peniaze za objednávku ${order} sú na ceste späť k vám.`,
    eyebrow: "Objednávka",
    title: "Peniaze",
    accent: "na ceste späť.",
    introManual: "peniaze za vašu objednávku vám vraciam ručne — prevodom na účet alebo v hotovosti.",
    introGateway:
      "peniaze za vašu objednávku som odoslala späť. Vracajú sa k vám rovnakou cestou, akou ku mne prišli.",
    order: "Objednávka",
    reason: "Dôvod vrátenia",
    lines: "Vrátené položky",
    amount: "Suma",
    method: "Spôsob",
    creditNote: "Dobropis",
    creditNoteNo: (number) => `č. ${number}`,
    paidForHeading: "Za čo vraciame peniaze",
    noteManual: "Ak od vás budem potrebovať číslo účtu, ozvem sa e-mailom.",
    noteGateway: "Na účte ich uvidíte spravidla do 3–5 pracovných dní.",
    viewOrder: "Zobraziť objednávku",
    creditNotePdf: "Dobropis (PDF)",
    bankTiming: "Presná doba pripísania závisí od vašej banky. ",
    contact: "Keby čokoľvek, napíšte mi na info@keramickazahrada.cz — odpovedám sama.",
  },
  pl: {
    preview: (order) => `Pieniądze za zamówienie ${order} są już w drodze do Państwa.`,
    eyebrow: "Zamówienie",
    title: "Pieniądze",
    accent: "w drodze powrotnej.",
    introManual: "Pieniądze za zamówienie zwracam ręcznie — przelewem na konto albo gotówką.",
    introGateway:
      "Odesłałam pieniądze za Państwa zamówienie. Wracają tą samą drogą, którą do mnie dotarły.",
    order: "Zamówienie",
    reason: "Powód zwrotu",
    lines: "Zwrócone pozycje",
    amount: "Kwota",
    method: "Sposób",
    creditNote: "Faktura korygująca",
    creditNoteNo: (number) => `nr ${number}`,
    paidForHeading: "Za co zwracamy pieniądze",
    noteManual: "Jeśli będę potrzebować numeru konta, odezwę się e-mailem.",
    noteGateway: "Na koncie pojawią się zwykle w ciągu 3–5 dni roboczych.",
    viewOrder: "Zobacz zamówienie",
    creditNotePdf: "Faktura korygująca (PDF)",
    bankTiming: "Dokładny termin zaksięgowania zależy od Państwa banku. ",
    contact: "W razie pytań proszę pisać na info@keramickazahrada.cz — odpowiadam osobiście.",
  },
  de: {
    preview: (order) => `Ihr Geld für die Bestellung ${order} ist auf dem Weg zurück zu Ihnen.`,
    eyebrow: "Bestellung",
    title: "Ihr Geld",
    accent: "ist auf dem Rückweg.",
    introManual: "den Betrag für Ihre Bestellung erstatte ich manuell – per Überweisung oder bar.",
    introGateway:
      "den Betrag für Ihre Bestellung habe ich zurückgeschickt. Er kommt auf demselben Weg zu Ihnen zurück, auf dem er bei mir eingegangen ist.",
    order: "Bestellung",
    reason: "Grund der Erstattung",
    lines: "Erstattete Positionen",
    amount: "Betrag",
    method: "Weg",
    creditNote: "Gutschrift",
    creditNoteNo: (number) => `Nr. ${number}`,
    paidForHeading: "Wofür wir erstatten",
    noteManual: "Falls ich Ihre Kontonummer brauche, melde ich mich per E-Mail.",
    noteGateway: "Auf Ihrem Konto sehen Sie ihn in der Regel innerhalb von 3–5 Werktagen.",
    viewOrder: "Bestellung ansehen",
    creditNotePdf: "Gutschrift (PDF)",
    bankTiming: "Wann genau der Betrag gutgeschrieben wird, hängt von Ihrer Bank ab. ",
    contact: "Bei Fragen schreiben Sie mir an info@keramickazahrada.cz – ich antworte selbst.",
  },
  en: {
    preview: (order) => `The money for order ${order} is on its way back to you.`,
    eyebrow: "Order",
    title: "Your money",
    accent: "is on its way back.",
    introManual: "I'm refunding the money for your order manually — by bank transfer or in cash.",
    introGateway:
      "I have sent the money for your order back to you. It's returning the same way it reached me.",
    order: "Order",
    reason: "Reason for refund",
    lines: "Refunded items",
    amount: "Amount",
    method: "Method",
    creditNote: "Credit note",
    creditNoteNo: (number) => `No. ${number}`,
    paidForHeading: "What we are refunding",
    noteManual: "If I need your account number, I'll get in touch by e-mail.",
    noteGateway: "It usually appears in your account within 3–5 working days.",
    viewOrder: "View order",
    creditNotePdf: "Credit note (PDF)",
    bankTiming: "Exactly when it arrives depends on your bank. ",
    contact: "If anything comes up, write to me at info@keramickazahrada.cz — I answer every message myself.",
  },
}

/**
 * Důvod a částka se vykreslí jen s reálnými daty — vymyšlená výchozí částka
 * („1 250 Kč") by v ostrém e-mailu slibovala jiné peníze, než se vracejí.
 * Věta o připsání se řídí způsobem: u karty lhůta banky, u ručního vrácení
 * žádný slib „do 3–5 dnů" (ten by u převodu, který majitelka teprve zadá,
 * byl lež). Bez `refundMethod` (starší volající) zůstává původní text.
 * Způsob přes bránu se pozná podle slova „ComGate", které nese každý jazyk.
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
  const t = useCopy(COPY)
  const vypisSFotkami = Boolean(paidFor?.length)
  const manual = Boolean(refundMethod && !/comgate|kart/i.test(refundMethod))
  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{manual ? t.introManual : t.introGateway}</P>

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {refundReason ? (
        <LedgerRow label={t.reason} value={refundReason} />
      ) : null}
      {/* Textový výpis jen tam, kde fotky nejsou (starší e-maily ve frontě) —
          jinak by stejné položky stály v e-mailu dvakrát. */}
      {refundLines && !vypisSFotkami ? (
        <LedgerRow label={t.lines} value={<MultiLine value={refundLines} />} />
      ) : null}
      {refundAmount ? (
        <LedgerRow label={t.amount} value={refundAmount} strong tone="olive" />
      ) : null}
      {refundMethod ? <LedgerRow label={t.method} value={refundMethod} /> : null}
      {creditNoteNumber ? (
        <LedgerRow label={t.creditNote} value={t.creditNoteNo(creditNoteNumber)} />
      ) : null}
      <LedgerEnd />

      {/* Za co peníze vracíme — košík vrácení s fotkami. */}
      <PaidFor items={paidFor} heading={t.paidForHeading} />

      <Note tone="olive">{manual ? t.noteManual : t.noteGateway}</Note>

      {orderLink || creditNoteUrl ? (
        <ButtonRow>
          {orderLink ? <EmailButton href={orderLink}>{t.viewOrder}</EmailButton> : null}
          {creditNoteUrl ? (
            <>
              {orderLink ? <span style={{ display: "inline-block", width: "12px" }} /> : null}
              <EmailButton href={creditNoteUrl} variant={orderLink ? "ghost" : undefined}>
                {t.creditNotePdf}
              </EmailButton>
            </>
          ) : null}
        </ButtonRow>
      ) : null}

      <P small>
        {manual ? "" : t.bankTiming}
        {creditNoteNote ? `${creditNoteNote} ` : ""}
        {t.contact}
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const OrderRefundedEmail = (props: OrderRefundedEmailProps) => (
  <OrderRefundedEmailComponent {...props} />
)

// Mock data for preview/development — důvod a řádky skládá odesílatel
// v jazyce zákazníka (lib/claims/email-copy, lib/email-items).
const THUMB = "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png"
const mockOrderRefunded: Localized<OrderRefundedEmailProps> = {
  cs: {
    customerName: "Jan Novák",
    orderNumber: "#12345",
    refundAmount: "1 250 Kč",
    refundReason: "Vrácení rozdílu po úpravě objednávky",
    orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
    paidFor: [
      { title: "Keramické pítko pro ptáky", subtitle: "Modrá glazura", quantity: 1, amount: "1 160 Kč", thumbnail: THUMB },
      { title: "Poštovné", amount: "90 Kč", service: true },
    ],
  },
  sk: {
    customerName: "Ján Novák",
    orderNumber: "#12345",
    refundAmount: "50,60 €",
    refundReason: "Vrátenie rozdielu po úprave objednávky",
    orderLink: "https://keramickazahrada.cz/sk/order/order_12345/confirmed",
    paidFor: [
      { title: "Keramické napájadlo pre vtáky", subtitle: "Modrá glazúra", quantity: 1, amount: "46,90 €", thumbnail: THUMB },
      { title: "Poštovné", amount: "3,70 €", service: true },
    ],
  },
  pl: {
    customerName: "Anna Nowak",
    orderNumber: "#12345",
    refundAmount: "219,00 zł",
    refundReason: "Zwrot różnicy po zmianie zamówienia",
    orderLink: "https://keramickazahrada.cz/pl/order/order_12345/confirmed",
    paidFor: [
      { title: "Ceramiczne poidełko dla ptaków", subtitle: "Niebieskie szkliwo", quantity: 1, amount: "203,00 zł", thumbnail: THUMB },
      { title: "Wysyłka", amount: "16,00 zł", service: true },
    ],
  },
  de: {
    customerName: "Jana Neumann",
    orderNumber: "#12345",
    refundAmount: "50,60 €",
    refundReason: "Erstattung der Differenz nach Änderung der Bestellung",
    orderLink: "https://keramickazahrada.cz/de/order/order_12345/confirmed",
    paidFor: [
      { title: "Vogeltränke aus Keramik", subtitle: "Blaue Glasur", quantity: 1, amount: "46,90 €", thumbnail: THUMB },
      { title: "Versand", amount: "3,70 €", service: true },
    ],
  },
  en: {
    customerName: "Emma Clarke",
    orderNumber: "#12345",
    refundAmount: "€50.60",
    refundReason: "Refund of the difference after your order was changed",
    orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
    paidFor: [
      { title: "Ceramic bird bath", subtitle: "Blue glaze", quantity: 1, amount: "€46.90", thumbnail: THUMB },
      { title: "Postage", amount: "€3.70", service: true },
    ],
  },
}

const OrderRefundedPreview = () => (
  <OrderRefundedEmailComponent {...mockOrderRefunded[useEmailLocale()]} />
)

export default () => <OrderRefundedPreview />
