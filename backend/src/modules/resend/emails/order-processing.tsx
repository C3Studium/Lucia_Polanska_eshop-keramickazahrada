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

interface OrderProcessingEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** Vlastní věta o dalším postupu — bez ní výchozí v jazyce e-mailu. */
  estimatedProcessingTime?: string;
  orderLink?: string;
  /** Předpokládané dokončení („5. 11. 2026"), když ho ateliér zadal. */
  estimatedCompletion?: string | null;
}

/**
 * Texty po jazycích (lib/email-locale) — čeština je původní znění. Věta
 * o nevratné záloze je právně nosná, překlad říká přesně totéž (viz
 * production-started.tsx).
 */
const COPY: Localized<{
  preview: (orderNumber: string) => string
  eyebrow: string
  title: string
  accent: string
  intro: (orderNumber: string) => string
  order: string
  estimate: string
  started: string
  deposit: string
  next: string
  viewOrder: string
  closing: string
}> = {
  cs: {
    preview: (n) => `Zakázka ${n} je ve výrobě — právě jsem se pustila do práce.`,
    eyebrow: "Zakázka",
    title: "Výroba",
    accent: "začíná.",
    intro: (n) =>
      `právě se pouštím do výroby vaší zakázky ${n}. Každý kousek u mě vzniká rukama — modelování, sušení, výpal i glazura si žádají svůj čas, tak prosím o trpělivost.`,
    order: "Objednávka",
    estimate: "Předpokládané dokončení",
    started: "Výroba právě začala — od této chvíle běží i lhůta dokončení.",
    deposit:
      "Od odeslání tohoto e-mailu platí, že při zrušení zakázky se záloha nevrací; všechno, co jste zaplatili nad zálohu, vám vrátím do 14 dnů. Tak to stojí v obchodních podmínkách (článek Výroba na zakázku), se kterými jste při objednávce souhlasili: záloha kryje materiál, návrh a čas, který už jsem do vašeho kousku vložila.",
    next: "Jakmile bude hotovo, napíšu vám a domluvíme se na odeslání nebo předání.",
    viewOrder: "Zobrazit objednávku",
    closing: "Děkuji a těším se,",
  },
  sk: {
    preview: (n) => `Zákazka ${n} je vo výrobe — práve som sa pustila do práce.`,
    eyebrow: "Zákazka",
    title: "Výroba",
    accent: "začína.",
    intro: (n) =>
      `práve sa púšťam do výroby vašej zákazky ${n}. Každý kúsok u mňa vzniká ručne — modelovanie, sušenie, výpal aj glazúra si žiadajú svoj čas, preto prosím o trpezlivosť.`,
    order: "Objednávka",
    estimate: "Predpokladané dokončenie",
    started: "Výroba práve začala — od tejto chvíle beží aj lehota na dokončenie.",
    deposit:
      "Od odoslania tohto e-mailu platí, že pri zrušení zákazky sa záloha nevracia; všetko, čo ste zaplatili nad zálohu, vám vrátim do 14 dní. Tak to stojí v obchodných podmienkach (článok „Výroba na zakázku“), s ktorými ste pri objednávke súhlasili: záloha pokrýva materiál, návrh a čas, ktorý som už do vášho kúska vložila.",
    next: "Hneď ako bude hotovo, napíšem vám a dohodneme sa na odoslaní alebo odovzdaní.",
    viewOrder: "Zobraziť objednávku",
    closing: "Ďakujem a teším sa,",
  },
  pl: {
    preview: (n) =>
      `Zamówienie indywidualne ${n} jest w realizacji — właśnie zaczęłam pracę.`,
    eyebrow: "Zamówienie indywidualne",
    title: "Produkcja",
    accent: "się zaczyna.",
    intro: (n) =>
      `Właśnie zaczynam wykonywać Państwa zamówienie indywidualne ${n}. Każdy egzemplarz powstaje u mnie ręcznie — modelowanie, suszenie, wypał i szkliwienie wymagają czasu, dlatego proszę o cierpliwość.`,
    order: "Zamówienie",
    estimate: "Przewidywany termin wykonania",
    started: "Produkcja właśnie się rozpoczęła — od tej chwili biegnie też termin wykonania.",
    deposit:
      "Od wysłania tego e-maila obowiązuje zasada, że w razie anulowania zamówienia indywidualnego zaliczka nie podlega zwrotowi; wszystko, co zapłacili Państwo ponad zaliczkę, zwrócę w ciągu 14 dni. Tak stanowi regulamin sklepu (artykuł „Výroba na zakázku“ — wykonanie na zamówienie), który zaakceptowali Państwo przy składaniu zamówienia: zaliczka pokrywa materiał, projekt i czas, który już włożyłam w Państwa wyrób.",
    next: "Gdy tylko skończę, napiszę do Państwa i ustalimy wysyłkę lub odbiór.",
    viewOrder: "Zobacz zamówienie",
    closing: "Dziękuję i serdecznie pozdrawiam",
  },
  de: {
    preview: (n) => `Ihre Auftragsarbeit ${n} ist in Arbeit – ich habe gerade damit begonnen.`,
    eyebrow: "Auftragsarbeit",
    title: "Die Herstellung",
    accent: "beginnt.",
    intro: (n) =>
      `ich beginne gerade mit der Herstellung Ihrer Auftragsarbeit ${n}. Jedes Stück entsteht bei mir von Hand – Modellieren, Trocknen, Brennen und Glasieren brauchen ihre Zeit, ich bitte Sie daher um etwas Geduld.`,
    order: "Bestellung",
    estimate: "Voraussichtliche Fertigstellung",
    started: "Die Herstellung hat gerade begonnen – ab jetzt läuft auch die Fertigstellungsfrist.",
    deposit:
      "Ab dem Versand dieser E-Mail gilt: Bei einer Stornierung der Auftragsarbeit wird die Anzahlung nicht erstattet; alles, was Sie über die Anzahlung hinaus bezahlt haben, erstatte ich Ihnen innerhalb von 14 Tagen. So steht es in den Geschäftsbedingungen (Artikel „Výroba na zakázku“ – Herstellung auf Bestellung), denen Sie bei der Bestellung zugestimmt haben: Die Anzahlung deckt das Material, den Entwurf und die Zeit, die ich bereits in Ihr Stück gesteckt habe.",
    next: "Sobald alles fertig ist, schreibe ich Ihnen und wir vereinbaren den Versand oder die Übergabe.",
    viewOrder: "Bestellung ansehen",
    closing: "Vielen Dank und herzliche Grüße",
  },
  en: {
    preview: (n) => `Your commission ${n} is in progress — I've just started work on it.`,
    eyebrow: "Commission",
    title: "Work",
    accent: "begins.",
    intro: (n) =>
      `I'm just starting work on your commission ${n}. Every piece I make is shaped by hand — modelling, drying, firing and glazing all take their time, so thank you for your patience.`,
    order: "Order",
    estimate: "Expected completion",
    started: "Work has just begun — from now on the completion period is running too.",
    deposit:
      "From the moment this e-mail is sent, the deposit is non-refundable if the commission is cancelled; anything you have paid on top of the deposit I will refund within 14 days. This is set out in the Terms and Conditions (the article “Výroba na zakázku” — made-to-order production), which you accepted when you placed your order: the deposit covers the materials, the design and the time I have already put into your piece.",
    next: "As soon as it's finished, I'll write to you and we'll arrange shipping or collection.",
    viewOrder: "View order",
    closing: "Thank you — I'm looking forward to it,",
  },
}

/**
 * „Výroba začíná" — posílá se při „Začít výrobu" (`start_production`).
 *
 * Do 14. 10. 2026 odcházel už při potvrzení zadání, i když výroba ještě
 * neběžela, a při skutečném začátku výroby pak nepřišlo nic. Potvrzení zadání
 * má teď vlastní e-mail (`commission-confirmed`).
 */
function OrderProcessingEmailComponent({
  customerName,
  orderNumber = "",
  estimatedProcessingTime,
  orderLink = "",
  estimatedCompletion,
}: OrderProcessingEmailProps) {
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
          {estimatedCompletion ? (
            <LedgerRow label={t.estimate} value={estimatedCompletion} />
          ) : null}
          <LedgerEnd />
        </>
      ) : null}

      <Note tone="olive">{t.started}</Note>

      <P>{t.deposit}</P>

      <P>{estimatedProcessingTime || t.next}</P>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>{t.viewOrder}</EmailButton>
        </ButtonRow>
      ) : null}

      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const OrderProcessingEmail = (props: OrderProcessingEmailProps) => (
  <OrderProcessingEmailComponent {...props} />
);

// Mock data for preview/development (věta o dalším postupu z výchozí kopie).
const mockOrderProcessing: OrderProcessingEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  orderLink: "https://keramickazahrada.cz/orders/12345",
};

export default () => <OrderProcessingEmailComponent {...mockOrderProcessing} />;
