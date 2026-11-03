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
  previewAmount: (amount: string) => string
  preview: string
  eyebrow: string
  title: string
  accent: string
  intro: (orderNumber: string) => string
  order: string
  product: string
  depositPaid: string
  method: string
  remaining: string
  paidFor: string
  invoiceBefore: (invoiceNumber: string) => string
  invoiceLink: string
  invoiceAfter: string
  yourCommission: string
  payAmount: (amount: string) => string
  payBalance: string
  afterPayment: string
  defaultMethod: string
  defaultConfirmation: string
  help: string
  closing: string
}> = {
  cs: {
    previewAmount: (a) => `Zbývá doplatek ${a} za vaši zakázku — zaplatíte jedním kliknutím.`,
    preview: "Zbývá doplatek za vaši zakázku — zaplatíte jedním kliknutím.",
    eyebrow: "Zakázka",
    title: "Prosím",
    accent: "o doplatek.",
    intro: (n) =>
      `posílám odkaz k zaplacení doplatku za vaši zakázku${n ? ` ${n}` : ""}. Zaplatit můžete kartou nebo převodem — stačí kliknout na tlačítko níže.`,
    order: "Objednávka",
    product: "Výrobek",
    depositPaid: "Zaplaceno zálohou",
    method: "Způsob platby",
    remaining: "Zbývá doplatit",
    paidFor: "Za co platíte",
    invoiceBefore: (n) => `Zálohovou fakturu${n ? ` ${n}` : ""} si můžete stáhnout`,
    invoiceLink: "zde",
    invoiceAfter: ". Fakturu na doplatek vám pošlu, jakmile ho zaplatíte.",
    yourCommission: "Vaše zakázka:",
    payAmount: (a) => `Zaplatit ${a}`,
    payBalance: "Zaplatit doplatek",
    afterPayment: "Jakmile doplatek dorazí, potvrdím vám ho e-mailem a domluvíme se na předání.",
    defaultMethod: "Platební karta nebo převod",
    defaultConfirmation: "Platba se obvykle potvrdí do několika minut.",
    help:
      "Kdyby vám odkaz nefungoval nebo jste si s čímkoli nevěděli rady, napište mi na info@keramickazahrada.cz — odpovídám sama.",
    closing: "Děkuji a těším se,",
  },
  sk: {
    previewAmount: (a) => `Zostáva doplatok ${a} za vašu zákazku — zaplatíte jedným kliknutím.`,
    preview: "Zostáva doplatok za vašu zákazku — zaplatíte jedným kliknutím.",
    eyebrow: "Zákazka",
    title: "Prosím",
    accent: "o doplatok.",
    intro: (n) =>
      `posielam odkaz na zaplatenie doplatku za vašu zákazku${n ? ` ${n}` : ""}. Zaplatiť môžete kartou alebo prevodom — stačí kliknúť na tlačidlo nižšie.`,
    order: "Objednávka",
    product: "Výrobok",
    depositPaid: "Zaplatené zálohou",
    method: "Spôsob platby",
    remaining: "Zostáva doplatiť",
    paidFor: "Za čo platíte",
    invoiceBefore: (n) => `Zálohovú faktúru${n ? ` ${n}` : ""} si môžete stiahnuť`,
    invoiceLink: "tu",
    invoiceAfter: ". Faktúru na doplatok vám pošlem, hneď ako ho zaplatíte.",
    yourCommission: "Vaša zákazka:",
    payAmount: (a) => `Zaplatiť ${a}`,
    payBalance: "Zaplatiť doplatok",
    afterPayment: "Hneď ako doplatok dorazí, potvrdím vám ho e-mailom a dohodneme sa na odovzdaní.",
    defaultMethod: "Platobná karta alebo prevod",
    defaultConfirmation: "Platba sa zvyčajne potvrdí do niekoľkých minút.",
    help:
      "Keby vám odkaz nefungoval alebo ste si s čímkoľvek nevedeli rady, napíšte mi na info@keramickazahrada.cz — odpovedám sama.",
    closing: "Ďakujem a teším sa,",
  },
  pl: {
    previewAmount: (a) =>
      `Do zapłaty pozostała dopłata ${a} za zamówienie indywidualne — wystarczy jedno kliknięcie.`,
    preview: "Do zapłaty pozostała dopłata za zamówienie indywidualne — wystarczy jedno kliknięcie.",
    eyebrow: "Zamówienie indywidualne",
    title: "Prośba",
    accent: "o dopłatę.",
    intro: (n) =>
      `Przesyłam link do zapłaty dopłaty za Państwa zamówienie indywidualne${n ? ` ${n}` : ""}. Można zapłacić kartą lub przelewem — wystarczy kliknąć przycisk poniżej.`,
    order: "Zamówienie",
    product: "Wyrób",
    depositPaid: "Zapłacono zaliczką",
    method: "Sposób płatności",
    remaining: "Pozostało do zapłaty",
    paidFor: "Za co Państwo płacą",
    invoiceBefore: (n) => `Fakturę zaliczkową${n ? ` ${n}` : ""} można pobrać`,
    invoiceLink: "tutaj",
    invoiceAfter: ". Fakturę na dopłatę wyślę, gdy tylko zostanie opłacona.",
    yourCommission: "Państwa zamówienie:",
    payAmount: (a) => `Zapłać ${a}`,
    payBalance: "Zapłać dopłatę",
    afterPayment: "Gdy tylko dopłata dotrze, potwierdzę ją e-mailem i umówimy się na przekazanie.",
    defaultMethod: "Karta płatnicza lub przelew",
    defaultConfirmation: "Płatność jest zwykle potwierdzana w ciągu kilku minut.",
    help:
      "Gdyby link nie działał albo coś było niejasne, proszę napisać na info@keramickazahrada.cz — odpowiadam osobiście.",
    closing: "Dziękuję i pozdrawiam serdecznie",
  },
  de: {
    previewAmount: (a) => `Für Ihre Auftragsarbeit ist noch die Restzahlung von ${a} offen – mit einem Klick bezahlt.`,
    preview: "Für Ihre Auftragsarbeit ist noch die Restzahlung offen – mit einem Klick bezahlt.",
    eyebrow: "Auftragsarbeit",
    title: "Bitte um",
    accent: "die Restzahlung.",
    intro: (n) =>
      `hier ist der Link zur Restzahlung für Ihre Auftragsarbeit${n ? ` ${n}` : ""}. Sie können per Karte oder Überweisung bezahlen – klicken Sie einfach auf die Schaltfläche unten.`,
    order: "Bestellung",
    product: "Artikel",
    depositPaid: "Bereits angezahlt",
    method: "Zahlungsart",
    remaining: "Noch zu zahlen",
    paidFor: "Wofür Sie bezahlen",
    invoiceBefore: (n) => `Die Anzahlungsrechnung${n ? ` ${n}` : ""} können Sie`,
    invoiceLink: "hier herunterladen",
    invoiceAfter: ". Die Rechnung über die Restzahlung schicke ich Ihnen, sobald sie bezahlt ist.",
    yourCommission: "Ihre Auftragsarbeit:",
    payAmount: (a) => `${a} bezahlen`,
    payBalance: "Restzahlung bezahlen",
    afterPayment:
      "Sobald die Restzahlung angekommen ist, bestätige ich sie Ihnen per E-Mail und wir vereinbaren die Übergabe.",
    defaultMethod: "Karte oder Überweisung",
    defaultConfirmation: "Die Zahlung wird in der Regel innerhalb weniger Minuten bestätigt.",
    help:
      "Falls der Link nicht funktioniert oder Sie Fragen haben, schreiben Sie mir an info@keramickazahrada.cz – ich antworte persönlich.",
    closing: "Vielen Dank und herzliche Grüße",
  },
  en: {
    previewAmount: (a) => `The remaining balance of ${a} for your commission — pay in one click.`,
    preview: "The remaining balance for your commission — pay in one click.",
    eyebrow: "Commission",
    title: "Your balance",
    accent: "payment.",
    intro: (n) =>
      `Here is the link to pay the remaining balance for your commission${n ? ` ${n}` : ""}. You can pay by card or bank transfer — just click the button below.`,
    order: "Order",
    product: "Piece",
    depositPaid: "Paid as deposit",
    method: "Payment method",
    remaining: "Remaining balance",
    paidFor: "What you are paying for",
    invoiceBefore: (n) => `You can download the deposit invoice${n ? ` ${n}` : ""}`,
    invoiceLink: "here",
    invoiceAfter: ". I'll send you the invoice for the balance as soon as it's paid.",
    yourCommission: "Your commission:",
    payAmount: (a) => `Pay ${a}`,
    payBalance: "Pay the balance",
    afterPayment:
      "As soon as the balance arrives, I'll confirm it by e-mail and we'll arrange the handover.",
    defaultMethod: "Card or bank transfer",
    defaultConfirmation: "Payments are usually confirmed within a few minutes.",
    help:
      "If the link doesn't work or anything is unclear, write to me at info@keramickazahrada.cz — I answer every message myself.",
    closing: "Thank you, and warm wishes,",
  },
}

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
  /** Bez hodnoty „karta nebo převod" v jazyce e-mailu. */
  paymentMethod?: string;
  /** Signed payment link — the button. */
  paymentLink?: string;
  /** Legacy alias: previous callers sent the payment URL as `orderLink`. */
  orderLink?: string;
  /** Whole sentence, e.g. „Platba se obvykle potvrdí do několika minut." */
  estimatedConfirmationTime?: string;
  /** Kolik už je zaplaceno zálohou (naformátované) — ať je jasné, co proběhlo. */
  depositPaid?: string | null;
  /** Odkaz na zálohovou (první) fakturu v PDF. */
  depositInvoiceUrl?: string | null;
  /** Číslo zálohové faktury (do textu odkazu). */
  depositInvoiceNumber?: string | null;
  /** Název položky zakázky — u objednávky s víc zakázkami říká, za který kus se doplácí. */
  productTitle?: string | null;
  /**
   * Za co se platí — položky objednávky s fotkou (`lib/email-items`). U
   * doplatku zakázky je to ten jeden kus, u ruční výzvy k zaplacení celá
   * objednávka. Bez nich e-mail ukáže jen částku, jako dřív.
   */
  paidFor?: EmailLineItem[] | null;
}

function PaymentPendingEmailComponent({
  customerName,
  productTitle,
  orderNumber = "",
  paymentAmount,
  paymentMethod,
  paymentLink = "",
  orderLink = "",
  estimatedConfirmationTime,
  makingPhotoUrl,
  depositPaid,
  depositInvoiceUrl,
  depositInvoiceNumber,
  paidFor,
}: PaymentPendingEmailProps) {
  const t = useCopy(COPY)
  const payUrl = paymentLink || orderLink || storeLink()

  return (
    <EmailLayout preview={paymentAmount ? t.previewAmount(paymentAmount) : t.preview}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(orderNumber)}</P>

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {productTitle ? <LedgerRow label={t.product} value={productTitle} /> : null}
      {depositPaid ? (
        <LedgerRow label={t.depositPaid} value={depositPaid} />
      ) : null}
      <LedgerRow label={t.method} value={paymentMethod || t.defaultMethod} />
      {paymentAmount ? (
        <LedgerRow label={t.remaining} value={paymentAmount} strong tone="clay" />
      ) : null}
      <LedgerEnd />

      {/* Za co se platí. U doplatku zakázky to říká řádek „Výrobek" a fotka
          níž; u ruční výzvy k zaplacení (celá objednávka) by jinak e-mail
          chtěl peníze a neřekl za co. */}
      <PaidFor items={paidFor} heading={t.paidFor} />

      {depositInvoiceUrl ? (
        <P small style={{ margin: "0 0 4px" }}>
          {t.invoiceBefore(depositInvoiceNumber ?? "")}{" "}
          <a href={depositInvoiceUrl}>{t.invoiceLink}</a>
          {t.invoiceAfter}
        </P>
      ) : null}

      {makingPhotoUrl && (
        <>
          <P small style={{ margin: "24px 0 8px" }}>
            {t.yourCommission}
          </P>
          <img
            src={makingPhotoUrl}
            alt={t.yourCommission.replace(/:$/, "")}
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
            {paymentAmount ? t.payAmount(paymentAmount) : t.payBalance}
          </EmailButton>
        </ButtonRow>
      ) : null}

      <Note tone="olive">{t.afterPayment}</Note>

      <P small>
        {estimatedConfirmationTime || t.defaultConfirmation} {t.help}
      </P>
      <Signature closing={t.closing} />
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
  paymentLink: "https://keramickazahrada.cz/cz/order/order_12345/pay-balance?token=abc",
  makingPhotoUrl:
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
  depositPaid: "1 225 Kč",
  depositInvoiceUrl: "https://keramickazahrada.cz/faktura-20260002.pdf",
  depositInvoiceNumber: "20260002",
  paidFor: [
    {
      title: "Keramické pítko pro ptáky",
      subtitle: "Modrá glazura",
      quantity: 1,
      amount: "2 450 Kč",
      thumbnail:
        "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
    },
  ],
}

export default () => <PaymentPendingEmailComponent {...mockPaymentPending} />
