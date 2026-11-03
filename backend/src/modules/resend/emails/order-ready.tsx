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
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: (orderNumber: string) => string
  eyebrow: string
  title: string
  accent: string
  intro: (orderNumber: string) => string
  order: string
  note: string
  viewOrder: string
}> = {
  cs: {
    preview: (n) => `Objednávka ${n} je zabalená, čeká už jen na dopravce.`,
    eyebrow: "Objednávka",
    title: "Zabaleno,",
    accent: "čeká jen na dopravce.",
    intro: (n) =>
      `vaši objednávku ${n} mám zabalenou a připravenou k odeslání — teď už jen čeká, až ji předám dopravci. Jakmile ji podám, napíšu vám a pošlu číslo zásilky, abyste mohli sledovat, kde právě je.`,
    order: "Objednávka",
    note: "Zabalené a připravené na cestu k vám.",
    viewOrder: "Zobrazit objednávku",
  },
  sk: {
    preview: (n) => `Objednávka ${n} je zabalená, čaká už len na prepravcu.`,
    eyebrow: "Objednávka",
    title: "Zabalené,",
    accent: "čaká už len na prepravcu.",
    intro: (n) =>
      `vašu objednávku ${n} mám zabalenú a pripravenú na odoslanie — teraz už len čaká, kým ju odovzdám prepravcovi. Hneď ako ju podám, napíšem vám a pošlem číslo zásielky, aby ste mohli sledovať, kde práve je.`,
    order: "Objednávka",
    note: "Zabalené a pripravené na cestu k vám.",
    viewOrder: "Zobraziť objednávku",
  },
  pl: {
    preview: (n) => `Zamówienie ${n} jest zapakowane i czeka już tylko na przewoźnika.`,
    eyebrow: "Zamówienie",
    title: "Zapakowane,",
    accent: "czeka tylko na przewoźnika.",
    intro: (n) =>
      `Państwa zamówienie ${n} jest zapakowane i gotowe do wysyłki — czeka już tylko, aż przekażę je przewoźnikowi. Gdy tylko je nadam, napiszę i prześlę numer przesyłki, żeby mogli Państwo śledzić, gdzie właśnie jest.`,
    order: "Zamówienie",
    note: "Zapakowane i gotowe do drogi.",
    viewOrder: "Zobacz zamówienie",
  },
  de: {
    preview: (n) => `Bestellung ${n} ist verpackt und wartet nur noch auf den Versand.`,
    eyebrow: "Bestellung",
    title: "Verpackt –",
    accent: "fehlt nur noch der Versand.",
    intro: (n) =>
      `Ihre Bestellung ${n} ist verpackt und versandbereit – jetzt wartet sie nur noch darauf, dass ich sie dem Versanddienst übergebe. Sobald ich sie aufgegeben habe, schreibe ich Ihnen und schicke die Sendungsnummer, damit Sie verfolgen können, wo sie gerade ist.`,
    order: "Bestellung",
    note: "Verpackt und bereit für die Reise zu Ihnen.",
    viewOrder: "Bestellung ansehen",
  },
  en: {
    preview: (n) => `Order ${n} is packed and just waiting for the courier.`,
    eyebrow: "Order",
    title: "All packed,",
    accent: "just waiting for the courier.",
    intro: (n) =>
      `Your order ${n} is packed and ready to go — now it's just waiting for me to hand it over to the courier. As soon as I've sent it off, I'll write to you with the tracking number so you can follow its journey.`,
    order: "Order",
    note: "Packed and ready for the journey to you.",
    viewOrder: "View order",
  },
}

interface OrderReadyEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
}

/**
 * „Objednávka je připravená k odeslání" — mezikrok mezi potvrzením a odesláním.
 * Posílá se, když majitelka přesune objednávku do fáze „K odeslání" (zabaleno,
 * čeká na předání dopravci). U osobního odběru a u čistě zakázkových objednávek
 * se NEposílá — ty mají vlastní e-mail („k vyzvednutí", resp. „zakázka hotová").
 */
function OrderReadyEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
}: OrderReadyEmailProps) {
  const t = useCopy(COPY)
  const orderUrl = orderLink || storeLink()
  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(orderNumber)}</P>

      {orderNumber ? (
        <>
          <LedgerRow label={t.order} value={orderNumber} strong />
          <LedgerEnd />
        </>
      ) : null}

      <Note tone="olive">{t.note}</Note>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>{t.viewOrder}</EmailButton>
        </ButtonRow>
      ) : null}

      <Signature />
    </EmailLayout>
  )
}

export const OrderReadyEmail = (props: OrderReadyEmailProps) => (
  <OrderReadyEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderReady: OrderReadyEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
}

export default () => <OrderReadyEmailComponent {...mockOrderReady} />
