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
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  previewAmount: (amount: string, orderNumber: string) => string
  preview: (orderNumber: string) => string
  eyebrow: string
  title: string
  accent: string
  intro: string
  order: string
  reason: string
  method: string
  original: string
  refunded: string
  orderContents: string
  viewOrder: string
  bankNote: string
  defaultMethod: string
  defaultTime: string
}> = {
  cs: {
    previewAmount: (a, n) => `Vracím vám ${a} za objednávku ${n}.`,
    preview: (n) => `Vracím vám platbu za objednávku ${n}.`,
    eyebrow: "Platba",
    title: "Platbu",
    accent: "vám vracím.",
    intro:
      "vrácení platby za vaši objednávku jsem zadala. Peníze se k vám vrací stejnou cestou, jakou ke mně přišly. Kdyby za tím bylo něco, co jsem mohla udělat lépe, budu ráda, když mi napíšete.",
    order: "Objednávka",
    reason: "Důvod vrácení",
    method: "Způsob vrácení",
    original: "Původní částka",
    refunded: "Vráceno",
    orderContents: "Co bylo v objednávce",
    viewOrder: "Zobrazit objednávku",
    bankNote:
      "Jak rychle se částka připíše, záleží na vaší bance a způsobu platby. Pokud se do uvedené lhůty neobjeví, napište mi na info@keramickazahrada.cz — podívám se na to.",
    defaultMethod: "Zpět na účet, ze kterého platba přišla",
    defaultTime: "Peníze by se na vašem účtu měly objevit do 3–5 pracovních dnů.",
  },
  sk: {
    previewAmount: (a, n) => `Vraciam vám ${a} za objednávku ${n}.`,
    preview: (n) => `Vraciam vám platbu za objednávku ${n}.`,
    eyebrow: "Platba",
    title: "Platbu",
    accent: "vám vraciam.",
    intro:
      "vrátenie platby za vašu objednávku som zadala. Peniaze sa k vám vracajú rovnakou cestou, akou prišli ku mne. Keby za tým bolo niečo, čo som mohla urobiť lepšie, budem rada, keď mi napíšete.",
    order: "Objednávka",
    reason: "Dôvod vrátenia",
    method: "Spôsob vrátenia",
    original: "Pôvodná suma",
    refunded: "Vrátené",
    orderContents: "Čo bolo v objednávke",
    viewOrder: "Zobraziť objednávku",
    bankNote:
      "Ako rýchlo sa suma pripíše, závisí od vašej banky a spôsobu platby. Ak sa do uvedenej lehoty neobjaví, napíšte mi na info@keramickazahrada.cz — pozriem sa na to.",
    defaultMethod: "Späť na účet, z ktorého platba prišla",
    defaultTime: "Peniaze by sa na vašom účte mali objaviť do 3–5 pracovných dní.",
  },
  pl: {
    previewAmount: (a, n) => `Zwracam Państwu ${a} za zamówienie ${n}.`,
    preview: (n) => `Zwracam Państwu płatność za zamówienie ${n}.`,
    eyebrow: "Płatność",
    title: "Zwracam",
    accent: "Państwu płatność.",
    intro:
      "Zleciłam zwrot płatności za Państwa zamówienie. Pieniądze wracają tą samą drogą, którą do mnie dotarły. Jeśli coś mogłam zrobić lepiej, chętnie się o tym dowiem — proszę do mnie napisać.",
    order: "Zamówienie",
    reason: "Powód zwrotu",
    method: "Sposób zwrotu",
    original: "Pierwotna kwota",
    refunded: "Zwrócono",
    orderContents: "Co było w zamówieniu",
    viewOrder: "Zobacz zamówienie",
    bankNote:
      "To, jak szybko kwota zostanie zaksięgowana, zależy od Państwa banku i sposobu płatności. Jeśli nie pojawi się w podanym terminie, proszę napisać na info@keramickazahrada.cz — sprawdzę to.",
    defaultMethod: "Z powrotem na konto, z którego wpłynęła płatność",
    defaultTime: "Pieniądze powinny pojawić się na Państwa koncie w ciągu 3–5 dni roboczych.",
  },
  de: {
    previewAmount: (a, n) => `Ich erstatte Ihnen ${a} für Bestellung ${n}.`,
    preview: (n) => `Ich erstatte Ihnen die Zahlung für Bestellung ${n}.`,
    eyebrow: "Zahlung",
    title: "Ihre Zahlung",
    accent: "erstatte ich Ihnen.",
    intro:
      "die Rückerstattung für Ihre Bestellung habe ich veranlasst. Das Geld geht auf demselben Weg an Sie zurück, auf dem es zu mir gekommen ist. Falls ich etwas hätte besser machen können, freue ich mich, wenn Sie mir schreiben.",
    order: "Bestellung",
    reason: "Grund der Erstattung",
    method: "Art der Erstattung",
    original: "Ursprünglicher Betrag",
    refunded: "Erstattet",
    orderContents: "Was in der Bestellung war",
    viewOrder: "Bestellung ansehen",
    bankNote:
      "Wie schnell der Betrag gutgeschrieben wird, hängt von Ihrer Bank und der Zahlungsart ab. Falls er nicht innerhalb der genannten Frist erscheint, schreiben Sie mir an info@keramickazahrada.cz – ich sehe nach.",
    defaultMethod: "Zurück auf das Konto, von dem die Zahlung kam",
    defaultTime: "Das Geld sollte innerhalb von 3–5 Werktagen auf Ihrem Konto sein.",
  },
  en: {
    previewAmount: (a, n) => `I'm refunding ${a} for order ${n}.`,
    preview: (n) => `I'm refunding your payment for order ${n}.`,
    eyebrow: "Payment",
    title: "I'm refunding",
    accent: "your payment.",
    intro:
      "I have arranged a refund for your order. The money will go back to you the same way it reached me. If there was anything I could have done better, I'd be glad if you'd write and tell me.",
    order: "Order",
    reason: "Reason for refund",
    method: "Refund method",
    original: "Original amount",
    refunded: "Refunded",
    orderContents: "What was in the order",
    viewOrder: "View order",
    bankNote:
      "How quickly the amount shows up depends on your bank and the payment method. If it hasn't appeared within that time, write to me at info@keramickazahrada.cz and I'll look into it.",
    defaultMethod: "Back to the account the payment came from",
    defaultTime: "The money should reach your account within 3–5 working days.",
  },
}

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
  refundMethod,
  estimatedRefundTime,
  orderLink = "",
  paidFor,
}: PaymentRefundedEmailProps) {
  const t = useCopy(COPY)
  const orderUrl = orderLink || storeLink()

  return (
    <EmailLayout
      preview={refundAmount ? t.previewAmount(refundAmount, orderNumber) : t.preview(orderNumber)}
    >
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro}</P>

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {refundReason ? (
        <LedgerRow label={t.reason} value={refundReason} />
      ) : null}
      <LedgerRow label={t.method} value={refundMethod || t.defaultMethod} />
      {originalPaymentAmount ? (
        <LedgerRow label={t.original} value={originalPaymentAmount} />
      ) : null}
      {refundAmount ? (
        <LedgerRow label={t.refunded} value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      {/* Které objednávky se peníze týkají. Nadpis mluví o objednávce, ne o
          vráceném zboží — tahle refundace může být částečná (výpis
          konkrétních vrácených kusů posílá modul reklamací ve svém e-mailu). */}
      <PaidFor items={paidFor} heading={t.orderContents} />

      <Note tone="olive">{estimatedRefundTime || t.defaultTime}</Note>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>{t.viewOrder}</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>{t.bankNote}</P>
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
