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

interface CommissionCancelledEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
  productTitle?: string | null;
  /** Před / po e-mailu „Zakázka je ve výrobě" (Z3). */
  phase?: "before_production" | "after_production";
  /** Kdo / co zrušení spustilo. */
  trigger?: "customer" | "unpaid_balance" | "seller";
  /** „20. 10. 2026 v 14:32" — kdy zrušení proběhlo. */
  cancelledAtText?: string;
  /** „15. 10. 2026 v 09:10" — kdy odešel e-mail o zahájení výroby (jen po zahájení). */
  productionStartedAtText?: string | null;
  /** Co bylo za zakázku zaplaceno (naformátované), nebo null = nic. */
  paidTotal?: string | null;
  /** Kolik vracíme (naformátované), null = nic. */
  refundAmount?: string | null;
  /** Záloha, která se nevrací (naformátované), null = žádná. */
  depositKept?: string | null;
  depositPercentage?: string | null;
  /** „stejnou cestou, jakou jste platili (přes ComGate)…" / „převodem…" — v jazyce e-mailu. */
  refundMethodText?: string | null;
  /** Potvrzení o vyřízení (PDF). */
  protocolUrl?: string | null;
}

/**
 * Texty po jazycích (lib/email-locale) — čeština je původní znění. Věty
 * o penězích (Z4–Z6: co se vrací, co ne, do kdy, proč) jsou právně nosné
 * a překlad říká přesně totéž; článek obchodních podmínek se jmenuje
 * česky, jiné znění podmínky nemají.
 */
const COPY: Localized<{
  preview: (orderNumber: string) => string
  eyebrow: string
  title: string
  accent: string
  unpaid: (orderNumber: string, productTitle: string) => string
  seller: (orderNumber: string, productTitle: string) => string
  customer: (orderNumber: string, productTitle: string) => string
  order: string
  product: string
  cancelled: string
  started: string
  paid: string
  kept: string
  refund: string
  nothingPaid: string
  beforeNote: (refund: string) => string
  beforeHow: (method: string) => string
  startedSuffix: (startedAt: string) => string
  afterRefundNote: (started: string, kept: string, refund: string) => string
  afterRefundHow: (method: string) => string
  afterNothingNote: (started: string, kept: string) => string
  afterNothingHow: string
  defaultMethod: string
  protocol: string
  questions: string
  viewOrder: string
  closingSeller: string
  closing: string
}> = {
  cs: {
    preview: (n) => `Zakázka ${n} je zrušená — tady je, jak to je s penězi.`,
    eyebrow: "Zakázka",
    title: "Zakázka je",
    accent: "zrušená.",
    unpaid: (n, title) =>
      `doplatek za zakázku ${n}${title ? ` (${title})` : ""} nedorazil do 30 dnů od výzvy ani po připomenutí. Podle obchodních podmínek (článek Výroba na zakázku) se tím zakázka ruší stejně, jako kdybyste ji zrušili sám/sama po zahájení výroby. Doplatek už po vás nechci.`,
    seller: (n, title) =>
      `zakázku ${n}${title ? ` (${title})` : ""} musím zrušit ze své strany. Moc mě to mrzí — podle obchodních podmínek vám vracím všechno, co jste zaplatili.`,
    customer: (n, title) =>
      `na vaši žádost jsem zrušila zakázku ${n}${title ? ` (${title})` : ""}. Níže píšu, jak to je s penězi — záleží na tom, zda už výroba začala (obchodní podmínky, článek Výroba na zakázku).`,
    order: "Objednávka",
    product: "Výrobek",
    cancelled: "Zrušeno",
    started: "Výroba zahájena",
    paid: "Zaplaceno",
    kept: "Záloha (nevrací se)",
    refund: "Vrátím vám",
    nothingPaid: "Zakázka je zrušená. Zaplaceno nebylo nic, takže není co vracet.",
    beforeNote: (refund) =>
      `Výroba ještě nezačala — vrátím vám všechno, ${refund}, do 14 dnů.`,
    beforeHow: (method) =>
      `Peníze pošlu ${method}. Kdy se připíšou, záleží na vaší bance — obvykle je to několik pracovních dnů.`,
    startedSuffix: (at) => ` (e-mail z ${at})`,
    afterRefundNote: (started, kept, refund) =>
      `Výroba už začala${started}, proto se záloha ${kept} nevrací. Všechno nad zálohu — ${refund} — vám vrátím do 14 dnů.`,
    afterRefundHow: (method) =>
      `Peníze pošlu ${method}. Záloha kryje materiál, návrh a čas, který už jsem do vašeho kousku vložila; doplatek po vás nechci a rozpracovaný výrobek zůstává u mě v dílně.`,
    afterNothingNote: (started, kept) =>
      `Výroba už začala${started}, proto se záloha ${kept} nevrací. Nad zálohu nebylo zaplaceno nic — není co vracet.`,
    afterNothingHow: "Doplatek po vás nechci a rozpracovaný výrobek zůstává u mě v dílně.",
    defaultMethod: "stejnou cestou, jakou ke mně platba přišla",
    protocol: "Potvrzení o vyřízení (PDF):",
    questions:
      "Pokud jste o zrušení nežádali nebo vám cokoli nesedí, napište mi na info@keramickazahrada.cz, odpovídám sama.",
    viewOrder: "Zobrazit objednávku",
    closingSeller: "Omlouvám se a děkuji za pochopení,",
    closing: "Přeji hezký den,",
  },
  sk: {
    preview: (n) => `Zákazka ${n} je zrušená — tu je, ako je to s peniazmi.`,
    eyebrow: "Zákazka",
    title: "Zákazka je",
    accent: "zrušená.",
    unpaid: (n, title) =>
      `doplatok za zákazku ${n}${title ? ` (${title})` : ""} nedorazil do 30 dní od výzvy ani po pripomenutí. Podľa obchodných podmienok (článok „Výroba na zakázku“) sa tým zákazka ruší rovnako, ako keby ste ju zrušili sami po začatí výroby. Doplatok už od vás nežiadam.`,
    seller: (n, title) =>
      `zákazku ${n}${title ? ` (${title})` : ""} musím zrušiť zo svojej strany. Veľmi ma to mrzí — podľa obchodných podmienok vám vraciam všetko, čo ste zaplatili.`,
    customer: (n, title) =>
      `na vašu žiadosť som zrušila zákazku ${n}${title ? ` (${title})` : ""}. Nižšie píšem, ako je to s peniazmi — záleží na tom, či už výroba začala (obchodné podmienky, článok „Výroba na zakázku“).`,
    order: "Objednávka",
    product: "Výrobok",
    cancelled: "Zrušené",
    started: "Výroba začatá",
    paid: "Zaplatené",
    kept: "Záloha (nevracia sa)",
    refund: "Vrátim vám",
    nothingPaid: "Zákazka je zrušená. Nebolo zaplatené nič, takže nie je čo vracať.",
    beforeNote: (refund) =>
      `Výroba ešte nezačala — vrátim vám všetko, ${refund}, do 14 dní.`,
    beforeHow: (method) =>
      `Peniaze pošlem ${method}. Kedy sa pripíšu, závisí od vašej banky — zvyčajne je to niekoľko pracovných dní.`,
    startedSuffix: (at) => ` (e-mail z ${at})`,
    afterRefundNote: (started, kept, refund) =>
      `Výroba už začala${started}, preto sa záloha ${kept} nevracia. Všetko nad zálohu — ${refund} — vám vrátim do 14 dní.`,
    afterRefundHow: (method) =>
      `Peniaze pošlem ${method}. Záloha pokrýva materiál, návrh a čas, ktorý som už do vášho kúska vložila; doplatok od vás nežiadam a rozpracovaný výrobok zostáva u mňa v dielni.`,
    afterNothingNote: (started, kept) =>
      `Výroba už začala${started}, preto sa záloha ${kept} nevracia. Nad zálohu nebolo zaplatené nič — nie je čo vracať.`,
    afterNothingHow: "Doplatok od vás nežiadam a rozpracovaný výrobok zostáva u mňa v dielni.",
    defaultMethod: "rovnakou cestou, akou ku mne platba prišla",
    protocol: "Potvrdenie o vybavení (PDF):",
    questions:
      "Ak ste o zrušenie nežiadali alebo vám čokoľvek nesedí, napíšte mi na info@keramickazahrada.cz, odpovedám sama.",
    viewOrder: "Zobraziť objednávku",
    closingSeller: "Ospravedlňujem sa a ďakujem za pochopenie,",
    closing: "Prajem pekný deň,",
  },
  pl: {
    preview: (n) =>
      `Zamówienie indywidualne ${n} zostało anulowane — oto jak wygląda kwestia pieniędzy.`,
    eyebrow: "Zamówienie indywidualne",
    title: "Zamówienie indywidualne",
    accent: "zostało anulowane.",
    unpaid: (n, title) =>
      `Dopłata za zamówienie indywidualne ${n}${title ? ` (${title})` : ""} nie wpłynęła w ciągu 30 dni od wezwania ani po przypomnieniu. Zgodnie z regulaminem (artykuł „Výroba na zakázku“ — wykonanie na zamówienie) zamówienie zostaje tym samym anulowane tak, jakby anulowali je Państwo sami po rozpoczęciu produkcji. Pozostałej kwoty już od Państwa nie żądam.`,
    seller: (n, title) =>
      `Zamówienie indywidualne ${n}${title ? ` (${title})` : ""} muszę anulować z mojej strony. Bardzo mi przykro — zgodnie z regulaminem zwracam Państwu wszystko, co zostało zapłacone.`,
    customer: (n, title) =>
      `Na Państwa prośbę anulowałam zamówienie indywidualne ${n}${title ? ` (${title})` : ""}. Poniżej opisuję, jak wygląda kwestia pieniędzy — zależy to od tego, czy produkcja już się rozpoczęła (regulamin, artykuł „Výroba na zakázku“).`,
    order: "Zamówienie",
    product: "Wyrób",
    cancelled: "Anulowano",
    started: "Rozpoczęcie produkcji",
    paid: "Zapłacono",
    kept: "Zaliczka (bez zwrotu)",
    refund: "Zwrócę Państwu",
    nothingPaid:
      "Zamówienie indywidualne zostało anulowane. Nic nie zostało zapłacone, więc nie ma czego zwracać.",
    beforeNote: (refund) =>
      `Produkcja jeszcze się nie rozpoczęła — zwrócę Państwu całość, ${refund}, w ciągu 14 dni.`,
    beforeHow: (method) =>
      `Pieniądze wyślę ${method}. Termin zaksięgowania zależy od Państwa banku — zwykle trwa to kilka dni roboczych.`,
    startedSuffix: (at) => ` (e-mail z ${at})`,
    afterRefundNote: (started, kept, refund) =>
      `Produkcja już się rozpoczęła${started}, dlatego zaliczka ${kept} nie podlega zwrotowi. Wszystko ponad zaliczkę — ${refund} — zwrócę Państwu w ciągu 14 dni.`,
    afterRefundHow: (method) =>
      `Pieniądze wyślę ${method}. Zaliczka pokrywa materiał, projekt i czas, który już włożyłam w Państwa wyrób; pozostałej kwoty od Państwa nie żądam, a rozpoczęty wyrób zostaje w mojej pracowni.`,
    afterNothingNote: (started, kept) =>
      `Produkcja już się rozpoczęła${started}, dlatego zaliczka ${kept} nie podlega zwrotowi. Ponad zaliczkę nic nie zostało zapłacone — nie ma czego zwracać.`,
    afterNothingHow:
      "Pozostałej kwoty od Państwa nie żądam, a rozpoczęty wyrób zostaje w mojej pracowni.",
    defaultMethod: "tą samą drogą, którą dotarła do mnie płatność",
    protocol: "Potwierdzenie rozpatrzenia (PDF):",
    questions:
      "Jeśli nie prosili Państwo o anulowanie albo coś się nie zgadza, proszę napisać na info@keramickazahrada.cz — odpowiadam osobiście.",
    viewOrder: "Zobacz zamówienie",
    closingSeller: "Przepraszam i dziękuję za zrozumienie",
    closing: "Serdecznie pozdrawiam",
  },
  de: {
    preview: (n) => `Ihre Auftragsarbeit ${n} ist storniert – so geht es mit dem Geld weiter.`,
    eyebrow: "Auftragsarbeit",
    title: "Ihre Auftragsarbeit",
    accent: "ist storniert.",
    unpaid: (n, title) =>
      `die Restzahlung für Ihre Auftragsarbeit ${n}${title ? ` (${title})` : ""} ist innerhalb von 30 Tagen nach der Zahlungsaufforderung auch nach einer Erinnerung nicht eingegangen. Nach den Geschäftsbedingungen (Artikel „Výroba na zakázku“ – Herstellung auf Bestellung) gilt die Auftragsarbeit damit als storniert, so als hätten Sie sie selbst nach Herstellungsbeginn storniert. Den Restbetrag verlange ich nicht mehr von Ihnen.`,
    seller: (n, title) =>
      `Ihre Auftragsarbeit ${n}${title ? ` (${title})` : ""} muss ich leider von meiner Seite stornieren. Das tut mir sehr leid – nach den Geschäftsbedingungen erstatte ich Ihnen alles, was Sie bezahlt haben.`,
    customer: (n, title) =>
      `auf Ihren Wunsch habe ich die Auftragsarbeit ${n}${title ? ` (${title})` : ""} storniert. Unten schreibe ich, wie es mit dem Geld aussieht – das hängt davon ab, ob die Herstellung schon begonnen hat (Geschäftsbedingungen, Artikel „Výroba na zakázku“).`,
    order: "Bestellung",
    product: "Produkt",
    cancelled: "Storniert",
    started: "Herstellung begonnen",
    paid: "Bezahlt",
    kept: "Anzahlung (keine Erstattung)",
    refund: "Ich erstatte Ihnen",
    nothingPaid:
      "Die Auftragsarbeit ist storniert. Es wurde nichts bezahlt, daher gibt es nichts zu erstatten.",
    beforeNote: (refund) =>
      `Die Herstellung hat noch nicht begonnen – ich erstatte Ihnen den vollen Betrag von ${refund} innerhalb von 14 Tagen.`,
    beforeHow: (method) =>
      `Das Geld überweise ich ${method}. Wann es gutgeschrieben wird, hängt von Ihrer Bank ab – meist dauert es einige Werktage.`,
    startedSuffix: (at) => ` (E-Mail vom ${at})`,
    afterRefundNote: (started, kept, refund) =>
      `Die Herstellung hat bereits begonnen${started}, deshalb wird die Anzahlung von ${kept} nicht erstattet. Alles darüber hinaus – ${refund} – erstatte ich Ihnen innerhalb von 14 Tagen.`,
    afterRefundHow: (method) =>
      `Das Geld überweise ich ${method}. Die Anzahlung deckt das Material, den Entwurf und die Zeit, die ich bereits in Ihr Stück gesteckt habe; den Restbetrag verlange ich nicht, und das angefangene Stück bleibt in meiner Werkstatt.`,
    afterNothingNote: (started, kept) =>
      `Die Herstellung hat bereits begonnen${started}, deshalb wird die Anzahlung von ${kept} nicht erstattet. Darüber hinaus wurde nichts bezahlt – es gibt nichts zu erstatten.`,
    afterNothingHow:
      "Den Restbetrag verlange ich nicht, und das angefangene Stück bleibt in meiner Werkstatt.",
    defaultMethod: "auf demselben Weg, auf dem Ihre Zahlung bei mir eingegangen ist",
    protocol: "Bestätigung der Erledigung (PDF):",
    questions:
      "Falls Sie die Stornierung nicht beantragt haben oder etwas nicht stimmt, schreiben Sie mir an info@keramickazahrada.cz – ich antworte persönlich.",
    viewOrder: "Bestellung ansehen",
    closingSeller: "Ich bitte um Entschuldigung und danke für Ihr Verständnis",
    closing: "Herzliche Grüße",
  },
  en: {
    preview: (n) => `Your commission ${n} has been cancelled — here is what happens with the money.`,
    eyebrow: "Commission",
    title: "Your commission",
    accent: "has been cancelled.",
    unpaid: (n, title) =>
      `The balance payment for your commission ${n}${title ? ` (${title})` : ""} did not arrive within 30 days of my request, not even after a reminder. Under the terms and conditions (the article “Výroba na zakázku” — made-to-order production), this cancels the commission just as if you had cancelled it yourself after production had started. I will no longer ask you for the remaining balance.`,
    seller: (n, title) =>
      `I'm afraid I have to cancel your commission ${n}${title ? ` (${title})` : ""} on my side. I'm truly sorry — under the terms and conditions, I'm refunding everything you have paid.`,
    customer: (n, title) =>
      `As you requested, I have cancelled your commission ${n}${title ? ` (${title})` : ""}. Below you'll find what happens with the money — it depends on whether production had already started (terms and conditions, the article “Výroba na zakázku”).`,
    order: "Order",
    product: "Piece",
    cancelled: "Cancelled",
    started: "Production started",
    paid: "Paid",
    kept: "Deposit (non-refundable)",
    refund: "I will refund",
    nothingPaid: "Your commission has been cancelled. Nothing was paid, so there is nothing to refund.",
    beforeNote: (refund) =>
      `Production had not started yet — I will refund the full amount, ${refund}, within 14 days.`,
    beforeHow: (method) =>
      `I will send the money ${method}. When it reaches your account depends on your bank — it usually takes a few working days.`,
    startedSuffix: (at) => ` (my e-mail of ${at})`,
    afterRefundNote: (started, kept, refund) =>
      `Production had already started${started}, so the deposit of ${kept} is non-refundable. Everything above the deposit — ${refund} — I will refund within 14 days.`,
    afterRefundHow: (method) =>
      `I will send the money ${method}. The deposit covers the materials, the design and the time I have already put into your piece; I won't ask you for the remaining balance, and the unfinished piece stays with me in the studio.`,
    afterNothingNote: (started, kept) =>
      `Production had already started${started}, so the deposit of ${kept} is non-refundable. Nothing was paid above the deposit — so there is nothing to refund.`,
    afterNothingHow:
      "I won't ask you for the remaining balance, and the unfinished piece stays with me in the studio.",
    defaultMethod: "the same way your payment reached me",
    protocol: "Confirmation of settlement (PDF):",
    questions:
      "If you didn't ask for the cancellation or anything doesn't look right, please write to me at info@keramickazahrada.cz — I answer every e-mail myself.",
    viewOrder: "View order",
    closingSeller: "With my apologies, and thank you for your understanding,",
    closing: "Warm wishes,",
  },
}

/**
 * „Zakázka zrušena" (LEGAL_AUDIT.md § 0, Z4–Z7) — jediný zákaznický e-mail za
 * zrušení zakázky. Tři podoby:
 *  - před zahájením výroby (Z4): vracíme vše do 14 dnů stejnou cestou;
 *  - po zahájení (Z5): záloha se nevrací, vše nad ni vracíme / „není co vracet";
 *  - nezaplacený doplatek (Z6): totéž co Z5, s vysvětlením proč.
 * O penězích mluví jen podle skutečně vyčíslené refundace — nic se neslibuje
 * naprázdno (stejná zásada jako `order-cancelled`).
 */
function CommissionCancelledEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
  productTitle,
  phase = "before_production",
  trigger = "customer",
  cancelledAtText,
  productionStartedAtText,
  paidTotal,
  refundAmount,
  depositKept,
  depositPercentage,
  refundMethodText,
  protocolUrl,
}: CommissionCancelledEmailProps) {
  const t = useCopy(COPY)
  const orderUrl = orderLink || storeLink()
  const after = phase === "after_production"
  const keptText = depositKept
    ? depositPercentage
      ? `${depositKept} (${depositPercentage} %)`
      : depositKept
    : null
  const methodText = refundMethodText ?? t.defaultMethod
  const startedSuffix = productionStartedAtText ? t.startedSuffix(productionStartedAtText) : ""
  const title = productTitle ?? ""

  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />

      {trigger === "unpaid_balance" ? (
        <P>{t.unpaid(orderNumber, title)}</P>
      ) : trigger === "seller" ? (
        <P>{t.seller(orderNumber, title)}</P>
      ) : (
        <P>{t.customer(orderNumber, title)}</P>
      )}

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} strong /> : null}
      {productTitle ? <LedgerRow label={t.product} value={productTitle} /> : null}
      {cancelledAtText ? <LedgerRow label={t.cancelled} value={cancelledAtText} /> : null}
      {after && productionStartedAtText ? (
        <LedgerRow label={t.started} value={productionStartedAtText} />
      ) : null}
      {paidTotal ? <LedgerRow label={t.paid} value={paidTotal} /> : null}
      {after && keptText ? (
        <LedgerRow label={t.kept} value={keptText} tone="clay" />
      ) : null}
      {refundAmount ? (
        <LedgerRow label={t.refund} value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      {!paidTotal ? (
        <>
          <Note tone="danger">{t.nothingPaid}</Note>
        </>
      ) : !after ? (
        <>
          <Note tone="olive">{t.beforeNote(refundAmount ?? "")}</Note>
          <P>{t.beforeHow(methodText)}</P>
        </>
      ) : refundAmount ? (
        <>
          <Note tone="clay">{t.afterRefundNote(startedSuffix, keptText ?? "", refundAmount)}</Note>
          <P>{t.afterRefundHow(methodText)}</P>
        </>
      ) : (
        <>
          <Note tone="clay">{t.afterNothingNote(startedSuffix, keptText ?? "")}</Note>
          <P>{t.afterNothingHow}</P>
        </>
      )}

      {protocolUrl ? (
        <P small>
          {t.protocol} <a href={protocolUrl}>{protocolUrl}</a>
        </P>
      ) : null}

      <P>{t.questions}</P>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl} variant="ghost">
            {t.viewOrder}
          </EmailButton>
        </ButtonRow>
      ) : null}

      <Signature closing={trigger === "seller" ? t.closingSeller : t.closing} />
    </EmailLayout>
  )
}

export const CommissionCancelledEmail = (props: CommissionCancelledEmailProps) => (
  <CommissionCancelledEmailComponent {...props} />
)

// Mock data for preview/development (způsob vrácení peněz skládá odesílatel
// v jazyce zákazníka — v náhledu výchozí věta šablony).
const mockCommissionCancelled: CommissionCancelledEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#0042",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  productTitle: "Domovní číslo s motivem levandule",
  phase: "after_production",
  trigger: "customer",
  cancelledAtText: "22. 10. 2026, 10:05",
  productionStartedAtText: "20. 10. 2026, 14:32",
  paidTotal: "5 000 Kč",
  refundAmount: "3 750 Kč",
  depositKept: "1 250 Kč",
  depositPercentage: "25",
}

export default () => <CommissionCancelledEmailComponent {...mockCommissionCancelled} />
