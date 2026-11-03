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
  eyebrow: (orderNumber: string) => string
  title: string
  accent: string
  intro: (orderNumber: string) => string
  order: string
  reason: string
  refunded: string
  nothingNeeded: string
  refundText: (amount: string) => string
  browse: string
  sorry: string
  questions: string
  closing: string
}> = {
  cs: {
    preview: (n) => `Objednávku ${n} jsem musela zrušit — omlouvám se.`,
    eyebrow: (n) => `Objednávka ${n}`,
    title: "Objednávka",
    accent: "je zrušená.",
    intro: (n) =>
      `mrzí mě to, ale vaši objednávku ${n} jsem zrušila. Pokud jste o zrušení nežádali nebo vám cokoli není jasné, napište mi na info@keramickazahrada.cz a dáme to do pořádku.`,
    order: "Objednávka",
    reason: "Důvod zrušení",
    refunded: "Vráceno",
    nothingNeeded: "Objednávka je zrušená, nic dalšího od vás nepotřebuji.",
    refundText: (a) =>
      `Zaplacenou částku${a ? ` ${a}` : ""} jsem vám vrátila stejnou cestou, jakou ke mně platba přišla. Kdy se peníze objeví na účtu, záleží na vaší bance — obvykle do několika pracovních dnů.`,
    browse: "Prohlédnout nabídku",
    sorry: "Omlouvám se za komplikace, které vám tím vznikly.",
    questions: " Kdybyste měli k platbě nebo ke zrušení otázku, napište mi na info@keramickazahrada.cz.",
    closing: "Omlouvám se a děkuji za pochopení,",
  },
  sk: {
    preview: (n) => `Objednávku ${n} som musela zrušiť — ospravedlňujem sa.`,
    eyebrow: (n) => `Objednávka ${n}`,
    title: "Objednávka",
    accent: "je zrušená.",
    intro: (n) =>
      `mrzí ma to, ale vašu objednávku ${n} som zrušila. Ak ste o zrušenie nežiadali alebo vám čokoľvek nie je jasné, napíšte mi na info@keramickazahrada.cz a dáme to do poriadku.`,
    order: "Objednávka",
    reason: "Dôvod zrušenia",
    refunded: "Vrátené",
    nothingNeeded: "Objednávka je zrušená, nič ďalšie od vás nepotrebujem.",
    refundText: (a) =>
      `Zaplatenú sumu${a ? ` ${a}` : ""} som vám vrátila rovnakou cestou, akou ku mne platba prišla. Kedy sa peniaze objavia na účte, závisí od vašej banky — zvyčajne do niekoľkých pracovných dní.`,
    browse: "Pozrieť ponuku",
    sorry: "Ospravedlňujem sa za komplikácie, ktoré vám tým vznikli.",
    questions: " Keby ste mali k platbe alebo k zrušeniu otázku, napíšte mi na info@keramickazahrada.cz.",
    closing: "Ospravedlňujem sa a ďakujem za pochopenie,",
  },
  pl: {
    preview: (n) => `Musiałam anulować zamówienie ${n} — przepraszam.`,
    eyebrow: (n) => `Zamówienie ${n}`,
    title: "Zamówienie",
    accent: "zostało anulowane.",
    intro: (n) =>
      `Przykro mi, ale anulowałam Państwa zamówienie ${n}. Jeśli nie prosili Państwo o anulowanie albo coś jest niejasne, proszę napisać na info@keramickazahrada.cz — wszystko wyjaśnimy.`,
    order: "Zamówienie",
    reason: "Powód anulowania",
    refunded: "Zwrócono",
    nothingNeeded: "Zamówienie jest anulowane, nic więcej nie jest potrzebne.",
    refundText: (a) =>
      `Zapłaconą kwotę${a ? ` ${a}` : ""} zwróciłam tą samą drogą, którą do mnie dotarła płatność. Kiedy pieniądze pojawią się na koncie, zależy od Państwa banku — zwykle w ciągu kilku dni roboczych.`,
    browse: "Zobacz ofertę",
    sorry: "Przepraszam za związane z tym niedogodności.",
    questions: " W razie pytań dotyczących płatności lub anulowania proszę pisać na info@keramickazahrada.cz.",
    closing: "Przepraszam i dziękuję za zrozumienie",
  },
  de: {
    preview: (n) => `Ich musste Bestellung ${n} stornieren – das tut mir leid.`,
    eyebrow: (n) => `Bestellung ${n}`,
    title: "Ihre Bestellung",
    accent: "ist storniert.",
    intro: (n) =>
      `es tut mir leid, aber ich habe Ihre Bestellung ${n} storniert. Wenn Sie die Stornierung nicht gewünscht haben oder etwas unklar ist, schreiben Sie mir an info@keramickazahrada.cz – wir bringen das in Ordnung.`,
    order: "Bestellung",
    reason: "Grund der Stornierung",
    refunded: "Erstattet",
    nothingNeeded: "Die Bestellung ist storniert, Sie müssen nichts weiter tun.",
    refundText: (a) =>
      `Den bezahlten Betrag${a ? ` von ${a}` : ""} habe ich Ihnen auf demselben Weg zurückerstattet, auf dem die Zahlung zu mir kam. Wann das Geld auf Ihrem Konto erscheint, hängt von Ihrer Bank ab – meist innerhalb weniger Werktage.`,
    browse: "Zum Sortiment",
    sorry: "Bitte entschuldigen Sie die Umstände.",
    questions: " Falls Sie Fragen zur Zahlung oder zur Stornierung haben, schreiben Sie mir an info@keramickazahrada.cz.",
    closing: "Mit der Bitte um Verständnis und herzlichen Grüßen",
  },
  en: {
    preview: (n) => `I've had to cancel order ${n} — I'm sorry.`,
    eyebrow: (n) => `Order ${n}`,
    title: "Your order",
    accent: "has been cancelled.",
    intro: (n) =>
      `I'm sorry, but I have cancelled your order ${n}. If you didn't ask for it to be cancelled, or anything is unclear, write to me at info@keramickazahrada.cz and we'll put it right.`,
    order: "Order",
    reason: "Reason for cancellation",
    refunded: "Refunded",
    nothingNeeded: "Your order has been cancelled — there's nothing more you need to do.",
    refundText: (a) =>
      `I have refunded the amount you paid${a ? ` (${a})` : ""} the same way the payment reached me. When it appears in your account depends on your bank — usually within a few working days.`,
    browse: "Browse the shop",
    sorry: "I'm sorry for any inconvenience this has caused.",
    questions: " If you have any questions about the payment or the cancellation, write to me at info@keramickazahrada.cz.",
    closing: "With apologies, and thank you for understanding,",
  },
}

interface OrderCancelledEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** Only when somebody actually stated one — no fabricated default. */
  reason?: string;
  /**
   * Jen když je refundace OPRAVDU zapsaná (refund_history). Bez vlajky e-mail o
   * penězích mlčí — slib „vrátíme do 3–5 dnů" u nezaplacené dobírky byl lež a u
   * zaplacené karty slib, který nikdo nehlídal.
   */
  refundRecorded?: boolean;
  /** Formátovaná vrácená částka (jen s `refundRecorded`). */
  refundAmount?: string;
}

/**
 * Důvod se vykreslí jen s reálnou hodnotou — výchozí „na žádost zákazníka"
 * by u zrušení z jiného důvodu tvrdilo zákazníkovi, že si ho vyžádal sám.
 */
function OrderCancelledEmailComponent({
  customerName,
  orderNumber = "",
  reason,
  refundRecorded,
  refundAmount,
}: OrderCancelledEmailProps) {
  const t = useCopy(COPY)
  const shopUrl = storeLink()
  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow(orderNumber)}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(orderNumber)}</P>

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {reason ? <LedgerRow label={t.reason} value={reason} /> : null}
      {refundRecorded && refundAmount ? (
        <LedgerRow label={t.refunded} value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      <Note tone="danger">{t.nothingNeeded}</Note>

      {refundRecorded ? <P>{t.refundText(refundAmount ?? "")}</P> : null}

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl} variant="ghost">
            {t.browse}
          </EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        {t.sorry}
        {refundRecorded ? "" : t.questions}
      </P>
      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const OrderCancelledEmail = (props: OrderCancelledEmailProps) => (
  <OrderCancelledEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderCancelled: OrderCancelledEmailProps = {
  customerName: "Anna Malá",
  orderNumber: "#12345",
  reason: "Vyprodáno",
  refundRecorded: true,
  refundAmount: "1 250 Kč",
}

export default () => <OrderCancelledEmailComponent {...mockOrderCancelled} />
