import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  Note,
  P,
  Signature,
} from "../components/email-ui"
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/**
 * Doposlání potvrzení smlouvy.
 *
 * ## Proč samostatný e-mail
 *
 * Potvrzení objednávky nikdy nečeká na PDF: když se dokument nepodaří
 * vyrobit nebo nahrát, e-mail odejde bez přílohy a chyba jde do logu —
 * zákazník nesmí zůstat bez potvrzení kvůli souboru. Tím ale vznikne dluh:
 * potvrzení smlouvy v textové podobě (§ 1827 odst. 2 OZ) poslané nebylo.
 *
 * Tenhle e-mail ho splácí. Posílá se z administrace tlačítkem, tedy vědomě,
 * a neopakuje celé potvrzení objednávky — jen doručí dokument a řekne, proč
 * chodí zvlášť. Zahlcovat zákazníka druhou kopií všeho by bylo horší než
 * ten původní výpadek.
 */
interface ContractResentEmailProps {
  customerName?: string
  orderNumber?: string
  /** „Potvrzení objednávky" nebo „Potvrzení zakázky". */
  documentTitle?: string
  /** Odkaz na PDF; prázdné, když šlo jen v příloze. */
  documentUrl?: string
  /** Stránka objednávky v obchodě. */
  orderLink?: string
}

/**
 * Název dokumentu posílá route česky (a tak je uložený i ve starých
 * notifikacích) — překládá se tady podle známých názvů. Neznámý název
 * zůstane, jak přišel.
 */
const TITLES: Record<string, Record<"sk" | "pl" | "de" | "en", string>> = {
  "Potvrzení objednávky": {
    sk: "Potvrdenie objednávky",
    pl: "Potwierdzenie zamówienia",
    de: "Bestellbestätigung",
    en: "Order confirmation",
  },
  "Potvrzení zakázky": {
    sk: "Potvrdenie zákazky",
    pl: "Potwierdzenie zamówienia indywidualnego",
    de: "Bestätigung der Auftragsarbeit",
    en: "Commission confirmation",
  },
  "Potvrzení zakázek": {
    sk: "Potvrdenia zákaziek",
    pl: "Potwierdzenia zamówień indywidualnych",
    de: "Bestätigungen der Auftragsarbeiten",
    en: "Commission confirmations",
  },
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  locale: "cs" | "sk" | "pl" | "de" | "en"
  number: (orderNumber: string) => string
  preview: (title: string, number: string) => string
  eyebrow: string
  accent: string
  body: (title: string, number: string) => string
  unchanged: string
  openDocument: string
  myOrder: string
  keep: string
}> = {
  cs: {
    locale: "cs",
    number: (n) => ` č. ${n}`,
    preview: (title, number) => `${title}${number} — dokument k vaší objednávce.`,
    eyebrow: "Dokumenty",
    accent: "posíláme dodatečně.",
    body: (title, number) =>
      `posíláme vám ${title.toLowerCase()}${number} — potvrzení kupní smlouvy, kterou jste s námi uzavřel(a). Při odesílání potvrzení objednávky se dokument nepodařilo přiložit, tak ho doručujeme teď. Omlouváme se za zdržení.`,
    unchanged:
      "Objednávka ani její podmínky se tím nijak nemění — je to tentýž dokument, který měl dorazit s potvrzením.",
    openDocument: "Otevřít dokument",
    myOrder: "Moje objednávka",
    keep: "Dokument si prosím uschovejte — spolu s obchodními podmínkami tvoří vaši smlouvu.",
  },
  sk: {
    locale: "sk",
    number: (n) => ` č. ${n}`,
    preview: (title, number) => `${title}${number} — dokument k vašej objednávke.`,
    eyebrow: "Dokumenty",
    accent: "posielame dodatočne.",
    body: (title, number) =>
      `posielame vám ${title.toLowerCase()}${number} — potvrdenie kúpnej zmluvy, ktorú ste s nami uzavreli. Pri odosielaní potvrdenia objednávky sa dokument nepodarilo priložiť, a tak vám ho doručujeme teraz. Ospravedlňujeme sa za oneskorenie.`,
    unchanged:
      "Objednávka ani jej podmienky sa tým nijako nemenia — je to ten istý dokument, ktorý mal prísť s potvrdením.",
    openDocument: "Otvoriť dokument",
    myOrder: "Moja objednávka",
    keep: "Dokument si, prosím, uschovajte — spolu s obchodnými podmienkami tvorí vašu zmluvu.",
  },
  pl: {
    locale: "pl",
    number: (n) => ` nr ${n}`,
    preview: (title, number) => `${title}${number} — dokument do Państwa zamówienia.`,
    eyebrow: "Dokumenty",
    accent: "przesyłamy dodatkowo.",
    body: (title, number) =>
      `Przesyłamy ${title.toLowerCase()}${number} — potwierdzenie umowy sprzedaży zawartej z nami. Przy wysyłce potwierdzenia zamówienia nie udało się dołączyć dokumentu, dlatego doręczamy go teraz. Przepraszamy za opóźnienie.`,
    unchanged:
      "Ani zamówienie, ani jego warunki się przez to nie zmieniają — to ten sam dokument, który powinien był dotrzeć wraz z potwierdzeniem.",
    openDocument: "Otwórz dokument",
    myOrder: "Moje zamówienie",
    keep: "Prosimy zachować dokument — razem z regulaminem stanowi on Państwa umowę.",
  },
  de: {
    locale: "de",
    number: (n) => ` Nr. ${n}`,
    preview: (title, number) => `${title}${number} – Dokument zu Ihrer Bestellung.`,
    eyebrow: "Dokumente",
    accent: "senden wir nach.",
    // Deutsche Substantive bleiben großgeschrieben — kein toLowerCase.
    body: (title, number) =>
      `anbei erhalten Sie die ${title}${number} – die Bestätigung des Kaufvertrags, den Sie mit uns geschlossen haben. Beim Versand der Bestellbestätigung ließ sich das Dokument nicht anhängen, deshalb senden wir es Ihnen jetzt. Bitte entschuldigen Sie die Verzögerung.`,
    unchanged:
      "An der Bestellung und ihren Bedingungen ändert sich dadurch nichts – es ist dasselbe Dokument, das mit der Bestätigung hätte ankommen sollen.",
    openDocument: "Dokument öffnen",
    myOrder: "Meine Bestellung",
    keep: "Bitte bewahren Sie das Dokument auf – zusammen mit den AGB bildet es Ihren Vertrag.",
  },
  en: {
    locale: "en",
    number: (n) => ` no. ${n}`,
    preview: (title, number) => `${title}${number} — a document for your order.`,
    eyebrow: "Documents",
    accent: "sent separately.",
    body: (title, number) =>
      `We're sending you your ${title.toLowerCase()}${number} — the confirmation of the purchase contract you concluded with us. When your order confirmation went out, the document couldn't be attached, so we're delivering it now. We're sorry for the delay.`,
    unchanged:
      "Neither your order nor its terms change in any way — this is the same document that should have arrived with the confirmation.",
    openDocument: "Open document",
    myOrder: "My order",
    keep: "Please keep this document — together with the Terms and Conditions, it forms your contract.",
  },
}

function ContractResentEmailComponent({
  customerName,
  orderNumber = "",
  documentTitle = "Potvrzení objednávky",
  documentUrl = "",
  orderLink = "",
}: ContractResentEmailProps) {
  const t = useCopy(COPY)
  const title =
    t.locale === "cs" ? documentTitle : TITLES[documentTitle.trim()]?.[t.locale] ?? documentTitle
  const cislo = orderNumber ? t.number(orderNumber) : ""
  return (
    <EmailLayout preview={t.preview(title, cislo)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.body(title, cislo)}</P>

      <P>{t.unchanged}</P>

      {documentUrl || orderLink ? (
        <ButtonRow>
          {documentUrl ? (
            <EmailButton href={documentUrl}>{t.openDocument}</EmailButton>
          ) : null}
          {orderLink ? (
            <EmailButton href={orderLink} variant="ghost">
              {t.myOrder}
            </EmailButton>
          ) : null}
        </ButtonRow>
      ) : null}

      <Note>{t.keep}</Note>

      <Signature />
    </EmailLayout>
  )
}

export const ContractResentEmail = (props: ContractResentEmailProps) => (
  <ContractResentEmailComponent {...props} />
)

const mock: ContractResentEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "1240",
  documentTitle: "Potvrzení objednávky",
  documentUrl: "https://img.matejforejt.com/orders/order_1/potvrzeni-objednavky.pdf",
  orderLink: "https://keramickazahrada.cz/cz/order/order_1/confirmed",
}

export default () => <ContractResentEmailComponent {...mock} />
