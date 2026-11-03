import { Img, Section } from "@react-email/components"
import {
  brand,
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

interface ProductionStartedEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
  /** Název objednaného výrobku (bez balného). */
  productTitle?: string | null;
  /** Obrázek objednaného produktu (ne fotka od zákazníka). */
  productImageUrl?: string | null;
  /** „20. 10. 2026 v 14:32" — pražský čas odeslání; od něj platí Z5. */
  startedAtText?: string;
  /** Smluvní záloha, naformátovaná („1 250 Kč"). */
  depositAmount?: string;
  /** Smluvní záloha v procentech („25"). */
  depositPercentage?: string | null;
  /** Termín, nebo „do N dnů od zahájení výroby (nejpozději …)". */
  estimatedCompletion?: string | null;
}

/**
 * Texty po jazycích (lib/email-locale) — čeština je původní znění.
 *
 * Věta o nevratné záloze (Z5) je právně nosná: překlad říká přesně totéž
 * — od odeslání tohoto e-mailu se záloha při zrušení nevrací, co bylo
 * zaplaceno nad ni, se vrátí do 14 dnů, doplatek se nevymáhá. Článek
 * obchodních podmínek se jmenuje česky (podmínky jiné znění nemají).
 */
const COPY: Localized<{
  preview: (orderNumber: string) => string
  eyebrow: string
  title: string
  accent: string
  intro: (orderNumber: string, productTitle: string) => string
  imageAlt: string
  order: string
  product: string
  started: string
  estimate: string
  deposit: string
  nonRefundable: (deposit: string) => string
  terms: string
  next: string
  viewOrder: string
  closing: string
}> = {
  cs: {
    preview: (n) => `Zakázka ${n} je ve výrobě — právě jsem se pustila do práce.`,
    eyebrow: "Zakázka",
    title: "Zakázka je",
    accent: "ve výrobě.",
    intro: (n, title) =>
      `právě jsem se pustila do výroby vaší zakázky ${n}${title ? ` — ${title}` : ""}. Každý kousek u mě vzniká rukama: modelování, sušení, výpal i glazura si žádají svůj čas, tak prosím o trpělivost.`,
    imageAlt: "Zakázka",
    order: "Objednávka",
    product: "Výrobek",
    started: "Výroba zahájena",
    estimate: "Předpokládané dokončení",
    deposit: "Záloha",
    nonRefundable: (deposit) =>
      `Od této chvíle — od odeslání tohoto e-mailu — se při zrušení zakázky záloha ${deposit} nevrací. Všechno, co jste zaplatili nad zálohu, vám vrátím do 14 dnů.`,
    terms:
      "Tak to stojí v obchodních podmínkách (článek Výroba na zakázku), se kterými jste při objednávce souhlasili: záloha kryje materiál, návrh a čas, který už jsem do vašeho kousku vložila. Doplatek po vás při zrušení chtít nebudu.",
    next:
      "Jakmile bude hotovo, napíšu vám a domluvíme se na odeslání nebo předání. Kdybyste mezitím cokoli potřebovali, napište mi na info@keramickazahrada.cz — odpovídám sama.",
    viewOrder: "Zobrazit objednávku",
    closing: "Děkuji a těším se,",
  },
  sk: {
    preview: (n) => `Zákazka ${n} je vo výrobe — práve som sa pustila do práce.`,
    eyebrow: "Zákazka",
    title: "Zákazka je",
    accent: "vo výrobe.",
    intro: (n, title) =>
      `práve som sa pustila do výroby vašej zákazky ${n}${title ? ` — ${title}` : ""}. Každý kúsok u mňa vzniká ručne: modelovanie, sušenie, výpal aj glazúra si žiadajú svoj čas, preto prosím o trpezlivosť.`,
    imageAlt: "Zákazka",
    order: "Objednávka",
    product: "Výrobok",
    started: "Výroba začatá",
    estimate: "Predpokladané dokončenie",
    deposit: "Záloha",
    nonRefundable: (deposit) =>
      `Od tejto chvíle — od odoslania tohto e-mailu — sa pri zrušení zákazky záloha ${deposit} nevracia. Všetko, čo ste zaplatili nad zálohu, vám vrátim do 14 dní.`,
    terms:
      "Tak to stojí v obchodných podmienkach (článok „Výroba na zakázku“), s ktorými ste pri objednávke súhlasili: záloha pokrýva materiál, návrh a čas, ktorý som už do vášho kúska vložila. Doplatok od vás pri zrušení žiadať nebudem.",
    next:
      "Hneď ako bude hotovo, napíšem vám a dohodneme sa na odoslaní alebo odovzdaní. Keby ste medzitým čokoľvek potrebovali, napíšte mi na info@keramickazahrada.cz — odpovedám sama.",
    viewOrder: "Zobraziť objednávku",
    closing: "Ďakujem a teším sa,",
  },
  pl: {
    preview: (n) =>
      `Zamówienie indywidualne ${n} jest w realizacji — właśnie zaczęłam pracę.`,
    eyebrow: "Zamówienie indywidualne",
    title: "Zamówienie indywidualne",
    accent: "jest w realizacji.",
    intro: (n, title) =>
      `Właśnie zaczęłam wykonywać Państwa zamówienie indywidualne ${n}${title ? ` — ${title}` : ""}. Każdy egzemplarz powstaje u mnie ręcznie: modelowanie, suszenie, wypał i szkliwienie wymagają czasu, dlatego proszę o cierpliwość.`,
    imageAlt: "Zamówienie indywidualne",
    order: "Zamówienie",
    product: "Wyrób",
    started: "Rozpoczęcie produkcji",
    estimate: "Przewidywany termin wykonania",
    deposit: "Zaliczka",
    nonRefundable: (deposit) =>
      `Od tej chwili — od wysłania tego e-maila — w razie anulowania zamówienia indywidualnego zaliczka ${deposit} nie podlega zwrotowi. Wszystko, co zapłacili Państwo ponad zaliczkę, zwrócę w ciągu 14 dni.`,
    terms:
      "Tak stanowi regulamin sklepu (artykuł „Výroba na zakázku“ — wykonanie na zamówienie), który zaakceptowali Państwo przy składaniu zamówienia: zaliczka pokrywa materiał, projekt i czas, który już włożyłam w Państwa wyrób. Pozostałej kwoty w razie anulowania nie będę od Państwa żądać.",
    next:
      "Gdy tylko skończę, napiszę do Państwa i ustalimy wysyłkę lub odbiór. Gdyby w międzyczasie czegoś Państwo potrzebowali, proszę napisać na info@keramickazahrada.cz — odpowiadam osobiście.",
    viewOrder: "Zobacz zamówienie",
    closing: "Dziękuję i serdecznie pozdrawiam",
  },
  de: {
    preview: (n) => `Ihre Auftragsarbeit ${n} ist in Arbeit – ich habe gerade damit begonnen.`,
    eyebrow: "Auftragsarbeit",
    title: "Ihre Auftragsarbeit",
    accent: "ist in Arbeit.",
    intro: (n, title) =>
      `ich habe gerade mit der Herstellung Ihrer Auftragsarbeit ${n}${title ? ` – ${title}` : ""} begonnen. Jedes Stück entsteht bei mir von Hand: Modellieren, Trocknen, Brennen und Glasieren brauchen ihre Zeit – ich bitte Sie daher um etwas Geduld.`,
    imageAlt: "Auftragsarbeit",
    order: "Bestellung",
    product: "Produkt",
    started: "Herstellung begonnen",
    estimate: "Voraussichtliche Fertigstellung",
    deposit: "Anzahlung",
    nonRefundable: (deposit) =>
      `Ab diesem Moment – ab dem Versand dieser E-Mail – wird die Anzahlung von ${deposit} bei einer Stornierung der Auftragsarbeit nicht erstattet. Alles, was Sie über die Anzahlung hinaus bezahlt haben, erstatte ich Ihnen innerhalb von 14 Tagen.`,
    terms:
      "So steht es in den Geschäftsbedingungen (Artikel „Výroba na zakázku“ – Herstellung auf Bestellung), denen Sie bei der Bestellung zugestimmt haben: Die Anzahlung deckt das Material, den Entwurf und die Zeit, die ich bereits in Ihr Stück gesteckt habe. Den Restbetrag werde ich bei einer Stornierung nicht von Ihnen verlangen.",
    next:
      "Sobald alles fertig ist, schreibe ich Ihnen und wir vereinbaren den Versand oder die Übergabe. Wenn Sie in der Zwischenzeit etwas brauchen, schreiben Sie mir an info@keramickazahrada.cz – ich antworte persönlich.",
    viewOrder: "Bestellung ansehen",
    closing: "Vielen Dank und herzliche Grüße",
  },
  en: {
    preview: (n) => `Your commission ${n} is in production — I've just started work on it.`,
    eyebrow: "Commission",
    title: "Your commission is",
    accent: "in production.",
    intro: (n, title) =>
      `I've just started making your commission ${n}${title ? ` — ${title}` : ""}. Every piece I make is shaped by hand: modelling, drying, firing and glazing all take their time, so thank you for your patience.`,
    imageAlt: "Commission",
    order: "Order",
    product: "Piece",
    started: "Production started",
    estimate: "Estimated completion",
    deposit: "Deposit",
    nonRefundable: (deposit) =>
      `From this moment — from the sending of this e-mail — the deposit of ${deposit} is non-refundable if the commission is cancelled. Anything you have paid above the deposit, I will refund within 14 days.`,
    terms:
      "This is set out in the terms and conditions (the article “Výroba na zakázku” — made-to-order production), which you agreed to when ordering: the deposit covers the materials, the design and the time I have already put into your piece. If the commission is cancelled, I won't ask you for the remaining balance.",
    next:
      "As soon as it's finished, I'll write to you and we'll arrange delivery or collection. If you need anything in the meantime, just write to me at info@keramickazahrada.cz — I answer every e-mail myself.",
    viewOrder: "View order",
    closing: "Thank you — I'm looking forward to it,",
  },
}

/**
 * „Zakázka je ve výrobě" (LEGAL_AUDIT.md § 0, Z3) — posílá se SYNCHRONNĚ při
 * „Začít výrobu" (lib/made-to-order/start-production). Zahájení výroby platí
 * od tohoto e-mailu, proto nese datum a čas, a větu Z5 o nevratné záloze —
 * sankce nesmí být schovaná jen v obchodních podmínkách (§ 1753 OZ, Z10).
 * Lhůta dokončení běží od zahájení (Z9).
 */
function ProductionStartedEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
  productTitle,
  productImageUrl,
  startedAtText = "",
  depositAmount = "",
  depositPercentage,
  estimatedCompletion,
}: ProductionStartedEmailProps) {
  const t = useCopy(COPY)
  const orderUrl = orderLink || storeLink()
  const depositText = depositPercentage
    ? `${depositAmount} (${depositPercentage} %)`
    : depositAmount
  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(orderNumber, productTitle ?? "")}</P>

      {productImageUrl ? (
        <Section style={{ margin: "20px 0 0" }}>
          <Img
            src={productImageUrl}
            alt={productTitle ?? t.imageAlt}
            width="100%"
            style={{
              maxWidth: "420px",
              borderRadius: "12px",
              objectFit: "cover",
              backgroundColor: brand.stone,
            }}
          />
        </Section>
      ) : null}

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} strong /> : null}
      {productTitle ? <LedgerRow label={t.product} value={productTitle} /> : null}
      {startedAtText ? (
        <LedgerRow label={t.started} value={startedAtText} tone="olive" />
      ) : null}
      {estimatedCompletion ? (
        <LedgerRow label={t.estimate} value={estimatedCompletion} />
      ) : null}
      {depositAmount ? <LedgerRow label={t.deposit} value={depositText} /> : null}
      <LedgerEnd />

      <Note tone="clay">{t.nonRefundable(depositText)}</Note>

      <P>{t.terms}</P>

      <P>{t.next}</P>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>{t.viewOrder}</EmailButton>
        </ButtonRow>
      ) : null}

      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const ProductionStartedEmail = (props: ProductionStartedEmailProps) => (
  <ProductionStartedEmailComponent {...props} />
)

// Mock data for preview/development (termín jen datem — slovní tvar skládá
// odesílatel v jazyce zákazníka, viz lib/made-to-order/start-production).
const mockProductionStarted: ProductionStartedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#0042",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  productTitle: "Domovní číslo s motivem levandule",
  startedAtText: "20. 10. 2026, 14:32",
  depositAmount: "1 250 Kč",
  depositPercentage: "25",
  estimatedCompletion: "1. 12. 2026",
}

export default () => <ProductionStartedEmailComponent {...mockProductionStarted} />
