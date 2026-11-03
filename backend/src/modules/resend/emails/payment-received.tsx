import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  P,
  PaidFor,
  Signature,
  type EmailLineItem,
} from "../components/email-ui"
import { storeLink } from "../../../lib/storefront-url"
import type { CommissionPaymentsText } from "../../../lib/commission-breakdown"
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: (orderNumber: string) => string
  eyebrow: string
  title: string
  accent: string
  introBalance: string
  intro: string
  order: string
  method: string
  deposit: string
  depositInvoice: (invoice: string) => string
  balance: string
  surcharge: string
  totalPaid: string
  amount: string
  paidForBalance: string
  paidFor: string
  viewOrder: string
  footer: string
  closing: string
}> = {
  cs: {
    preview: (n) => `Platba za objednávku ${n} dorazila, děkuji.`,
    eyebrow: "Platba",
    title: "Platba",
    accent: "dorazila.",
    introBalance:
      "doplatek za vaši zakázku dorazil, děkuji — zakázka je teď zaplacená celá. Kousek pečlivě zabalím a jakmile zásilku předám dopravci, pošlu vám další zprávu.",
    intro:
      "platba za vaši objednávku dorazila, děkuji. Teď je to na mně — kousky zabalím a jakmile zásilku předám dopravci, pošlu vám další zprávu.",
    order: "Objednávka",
    method: "Způsob platby",
    deposit: "Záloha",
    depositInvoice: (invoice) => `Záloha (faktura ${invoice})`,
    balance: "Doplatek",
    surcharge: "Příplatek",
    totalPaid: "Celkem zaplaceno",
    amount: "Částka",
    paidForBalance: "Za co je doplatek",
    paidFor: "Za co jste zaplatili",
    viewOrder: "Zobrazit objednávku",
    footer:
      "Stav objednávky vidíte kdykoli ve svém účtu na webu. Kdyby cokoli, napište mi na info@keramickazahrada.cz — odpovídám sama.",
    closing: "Děkuji a těším se,",
  },
  sk: {
    preview: (n) => `Platba za objednávku ${n} dorazila, ďakujem.`,
    eyebrow: "Platba",
    title: "Platba",
    accent: "dorazila.",
    introBalance:
      "doplatok za vašu zákazku dorazil, ďakujem — zákazka je teraz zaplatená celá. Kúsok starostlivo zabalím a hneď ako zásielku odovzdám prepravcovi, pošlem vám ďalšiu správu.",
    intro:
      "platba za vašu objednávku dorazila, ďakujem. Teraz je to na mne — kúsky zabalím a hneď ako zásielku odovzdám prepravcovi, pošlem vám ďalšiu správu.",
    order: "Objednávka",
    method: "Spôsob platby",
    deposit: "Záloha",
    depositInvoice: (invoice) => `Záloha (faktúra ${invoice})`,
    balance: "Doplatok",
    surcharge: "Príplatok",
    totalPaid: "Celkom zaplatené",
    amount: "Suma",
    paidForBalance: "Za čo je doplatok",
    paidFor: "Za čo ste zaplatili",
    viewOrder: "Zobraziť objednávku",
    footer:
      "Stav objednávky vidíte kedykoľvek vo svojom účte na webe. Keby čokoľvek, napíšte mi na info@keramickazahrada.cz — odpovedám sama.",
    closing: "Ďakujem a teším sa,",
  },
  pl: {
    preview: (n) => `Płatność za zamówienie ${n} dotarła, dziękuję.`,
    eyebrow: "Płatność",
    title: "Płatność",
    accent: "dotarła.",
    introBalance:
      "Dopłata za Państwa zamówienie indywidualne dotarła, dziękuję — zamówienie jest teraz w całości opłacone. Starannie je zapakuję, a gdy tylko przekażę przesyłkę przewoźnikowi, wyślę kolejną wiadomość.",
    intro:
      "Płatność za Państwa zamówienie dotarła, dziękuję. Teraz moja kolej — zapakuję ceramikę, a gdy tylko przekażę przesyłkę przewoźnikowi, wyślę kolejną wiadomość.",
    order: "Zamówienie",
    method: "Sposób płatności",
    deposit: "Zaliczka",
    depositInvoice: (invoice) => `Zaliczka (faktura ${invoice})`,
    balance: "Dopłata",
    surcharge: "Dopłata dodatkowa",
    totalPaid: "Łącznie zapłacono",
    amount: "Kwota",
    paidForBalance: "Czego dotyczy dopłata",
    paidFor: "Za co Państwo zapłacili",
    viewOrder: "Zobacz zamówienie",
    footer:
      "Stan zamówienia mogą Państwo w każdej chwili sprawdzić na swoim koncie na stronie. W razie pytań proszę pisać na info@keramickazahrada.cz — odpowiadam osobiście.",
    closing: "Dziękuję i pozdrawiam serdecznie",
  },
  de: {
    preview: (n) => `Die Zahlung für Bestellung ${n} ist angekommen – vielen Dank.`,
    eyebrow: "Zahlung",
    title: "Ihre Zahlung",
    accent: "ist angekommen.",
    introBalance:
      "die Restzahlung für Ihre Auftragsarbeit ist angekommen, vielen Dank – die Auftragsarbeit ist jetzt vollständig bezahlt. Ich verpacke das Stück sorgfältig und melde mich wieder, sobald ich das Paket dem Versanddienst übergeben habe.",
    intro:
      "die Zahlung für Ihre Bestellung ist angekommen, vielen Dank. Jetzt bin ich dran – ich verpacke die Stücke und melde mich wieder, sobald ich das Paket dem Versanddienst übergeben habe.",
    order: "Bestellung",
    method: "Zahlungsart",
    deposit: "Anzahlung",
    depositInvoice: (invoice) => `Anzahlung (Rechnung ${invoice})`,
    balance: "Restzahlung",
    surcharge: "Aufpreis",
    totalPaid: "Insgesamt bezahlt",
    amount: "Betrag",
    paidForBalance: "Wofür die Restzahlung ist",
    paidFor: "Wofür Sie bezahlt haben",
    viewOrder: "Bestellung ansehen",
    footer:
      "Den Stand Ihrer Bestellung sehen Sie jederzeit in Ihrem Kundenkonto. Bei Fragen schreiben Sie mir an info@keramickazahrada.cz – ich antworte persönlich.",
    closing: "Vielen Dank und herzliche Grüße",
  },
  en: {
    preview: (n) => `Your payment for order ${n} has arrived — thank you.`,
    eyebrow: "Payment",
    title: "Your payment",
    accent: "has arrived.",
    introBalance:
      "The balance payment for your commission has arrived — thank you. Your commission is now paid in full. I'll pack your piece carefully and write to you again as soon as I've handed the parcel over to the carrier.",
    intro:
      "The payment for your order has arrived — thank you. Now it's over to me: I'll pack your pieces and write to you again as soon as I've handed the parcel over to the carrier.",
    order: "Order",
    method: "Payment method",
    deposit: "Deposit",
    depositInvoice: (invoice) => `Deposit (invoice ${invoice})`,
    balance: "Balance payment",
    surcharge: "Surcharge",
    totalPaid: "Total paid",
    amount: "Amount",
    paidForBalance: "What the balance covers",
    paidFor: "What you paid for",
    viewOrder: "View order",
    footer:
      "You can check the status of your order at any time in your account on the website. If anything comes up, write to me at info@keramickazahrada.cz — I answer every message myself.",
    closing: "Thank you, and warm wishes,",
  },
}

interface PaymentReceivedEmailProps {
  customerName?: string;
  orderNumber?: string;
  paymentAmount?: string;
  paymentMethod?: string;
  orderLink?: string;
  /**
   * Za co platba byla — položky objednávky s fotkou (`lib/email-items`).
   * Bez nich e-mail ukáže jen čísla, jako dřív.
   */
  paidFor?: EmailLineItem[] | null;
  /**
   * Doplatek zakázky: rozpis záloha · doplatek · příplatek · celkem zaplaceno
   * (lib/commission-breakdown). Bez něj e-mail ukáže jen částku platby.
   */
  commissionPayments?: CommissionPaymentsText | null;
}

/**
 * Řádky se vykreslí jen s reálnými daty — vymyšlená výchozí částka by
 * v ostrém e-mailu potvrzovala jiné peníze, než dorazily.
 */
function PaymentReceivedEmailComponent({
  customerName,
  orderNumber = "",
  paymentAmount,
  paymentMethod,
  orderLink = "",
  paidFor,
  commissionPayments,
}: PaymentReceivedEmailProps) {
  const t = useCopy(COPY)
  const orderUrl = orderLink || storeLink()

  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{commissionPayments ? t.introBalance : t.intro}</P>

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {paymentMethod ? (
        <LedgerRow label={t.method} value={paymentMethod} />
      ) : null}
      {commissionPayments ? (
        <>
          {commissionPayments.deposit ? (
            <LedgerRow
              label={
                commissionPayments.depositInvoiceNumber
                  ? t.depositInvoice(commissionPayments.depositInvoiceNumber)
                  : t.deposit
              }
              value={commissionPayments.deposit}
            />
          ) : null}
          {commissionPayments.balance ? (
            <LedgerRow label={t.balance} value={commissionPayments.balance} />
          ) : null}
          {commissionPayments.surcharge ? (
            <LedgerRow label={t.surcharge} value={commissionPayments.surcharge} />
          ) : null}
          <LedgerRow
            label={t.totalPaid}
            value={commissionPayments.totalPaid}
            strong
            tone="olive"
          />
        </>
      ) : paymentAmount ? (
        <LedgerRow label={t.amount} value={paymentAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      {/* Za co ty peníze byly. Samotné „Částka 2 450 Kč" neřeklo, čeho se
          platba týká — kdo u nás koupil dvakrát za týden, nepoznal které
          objednávky. Faktura to říká, ale je to příloha, kterou si kvůli
          tomu nikdo neotvírá. */}
      <PaidFor
        items={paidFor}
        heading={commissionPayments ? t.paidForBalance : t.paidFor}
      />

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>{t.viewOrder}</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>{t.footer}</P>
      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const PaymentReceivedEmail = (props: PaymentReceivedEmailProps) => (
  <PaymentReceivedEmailComponent {...props} />
)

// Mock data for preview/development
const mockPaymentReceived: PaymentReceivedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  paymentAmount: "2 450 Kč",
  paymentMethod: "Kreditní karta",
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
    { title: "Balné — Keramické pítko pro ptáky", amount: "30 Kč", service: true },
    { title: "Miska na mýdlo", quantity: 2, amount: "470 Kč", thumbnail: null },
  ],
}

export default () => <PaymentReceivedEmailComponent {...mockPaymentReceived} />
