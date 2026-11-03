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

interface CommissionConfirmedEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
  /** Co se vyrábí (název položky zakázky). */
  productTitle?: string | null;
  /** Náhled objednaného produktu. */
  productImageUrl?: string | null;
  /** Domluvená cena zakázky vč. příplatku (naformátovaná). */
  totalPrice?: string | null;
  /** Kolik už je zaplaceno (záloha). */
  depositPaid?: string | null;
  /** Kolik zbývá doplatit po dokončení. */
  balanceDue?: string | null;
  /** Předpokládané dokončení („5. 11. 2026"), když ho ateliér zadal. */
  estimatedCompletion?: string | null;
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: (orderNumber: string) => string
  eyebrow: string
  title: string
  accent: string
  intro: (orderNumber: string) => string
  imageAlt: string
  commission: string
  agreedPrice: string
  depositPaid: string
  balanceDue: string
  estimate: string
  balanceNote: string
  paidNote: string
  viewOrder: string
  questions: string
  closing: string
}> = {
  cs: {
    preview: (n) => `Zadání zakázky ${n} je potvrzené — dám vědět, až se pustím do práce.`,
    eyebrow: "Zakázka",
    title: "Zadání je",
    accent: "potvrzené.",
    intro: (n) =>
      `prošla jsem si vaše zadání${n ? ` k objednávce ${n}` : ""} a všechno je jasné — zakázku potvrzuji a děkuji za ni. Jakmile se pustím do práce, napíšu vám e-mail; do té doby nemusíte nic dělat.`,
    imageAlt: "Vaše zakázka",
    commission: "Zakázka",
    agreedPrice: "Domluvená cena",
    depositPaid: "Zaplaceno zálohou",
    balanceDue: "Doplatíte po dokončení",
    estimate: "Předpokládané dokončení",
    balanceNote: "Doplatek budete platit až po dokončení — pošlu vám výzvu s odkazem na platbu.",
    paidNote: "Zakázka je zaplacená celá — teď je to na mně.",
    viewOrder: "Zobrazit objednávku",
    questions:
      "Kdybyste chtěli na zadání ještě něco upřesnit, napište mi na info@keramickazahrada.cz — odpovídám sama.",
    closing: "Děkuji a těším se,",
  },
  sk: {
    preview: (n) => `Zadanie zákazky ${n} je potvrdené — dám vedieť, keď sa pustím do práce.`,
    eyebrow: "Zákazka",
    title: "Zadanie je",
    accent: "potvrdené.",
    intro: (n) =>
      `prešla som si vaše zadanie${n ? ` k objednávke ${n}` : ""} a všetko je jasné — zákazku potvrdzujem a ďakujem za ňu. Hneď ako sa pustím do práce, napíšem vám e-mail; dovtedy nemusíte nič robiť.`,
    imageAlt: "Vaša zákazka",
    commission: "Zákazka",
    agreedPrice: "Dohodnutá cena",
    depositPaid: "Zaplatené zálohou",
    balanceDue: "Doplatíte po dokončení",
    estimate: "Predpokladané dokončenie",
    balanceNote: "Doplatok budete platiť až po dokončení — pošlem vám výzvu s odkazom na platbu.",
    paidNote: "Zákazka je zaplatená celá — teraz je to na mne.",
    viewOrder: "Zobraziť objednávku",
    questions:
      "Keby ste chceli v zadaní ešte niečo upresniť, napíšte mi na info@keramickazahrada.cz — odpovedám sama.",
    closing: "Ďakujem a teším sa,",
  },
  pl: {
    preview: (n) =>
      `Wytyczne do zamówienia indywidualnego ${n} są potwierdzone — dam znać, gdy zacznę pracę.`,
    eyebrow: "Zamówienie indywidualne",
    title: "Wytyczne są",
    accent: "potwierdzone.",
    intro: (n) =>
      `Przejrzałam Państwa wytyczne${n ? ` do zamówienia ${n}` : ""} i wszystko jest jasne — potwierdzam realizację i dziękuję za zaufanie. Gdy tylko zacznę pracę, napiszę do Państwa e-mail; do tego czasu nie trzeba nic robić.`,
    imageAlt: "Państwa zamówienie indywidualne",
    commission: "Wyrób na zamówienie",
    agreedPrice: "Uzgodniona cena",
    depositPaid: "Zapłacono zaliczką",
    balanceDue: "Dopłata po wykonaniu",
    estimate: "Przewidywany termin wykonania",
    balanceNote:
      "Pozostałą kwotę zapłacą Państwo dopiero po wykonaniu — wyślę wtedy prośbę z linkiem do płatności.",
    paidNote: "Całość jest już zapłacona — teraz wszystko w moich rękach.",
    viewOrder: "Zobacz zamówienie",
    questions:
      "Jeśli chcieliby Państwo jeszcze coś doprecyzować, proszę napisać na info@keramickazahrada.cz — odpowiadam osobiście.",
    closing: "Dziękuję i serdecznie pozdrawiam",
  },
  de: {
    preview: (n) =>
      `Die Vorgaben für Ihre Auftragsarbeit ${n} sind bestätigt – ich melde mich, sobald ich anfange.`,
    eyebrow: "Auftragsarbeit",
    title: "Die Vorgaben sind",
    accent: "bestätigt.",
    intro: (n) =>
      `ich habe mir Ihre Vorgaben${n ? ` zur Bestellung ${n}` : ""} angesehen und alles ist klar – ich bestätige den Auftrag und danke Ihnen dafür. Sobald ich mit der Arbeit beginne, schreibe ich Ihnen eine E-Mail; bis dahin müssen Sie nichts tun.`,
    imageAlt: "Ihre Auftragsarbeit",
    commission: "Auftragsarbeit",
    agreedPrice: "Vereinbarter Preis",
    depositPaid: "Als Anzahlung bezahlt",
    balanceDue: "Restzahlung nach Fertigstellung",
    estimate: "Voraussichtliche Fertigstellung",
    balanceNote:
      "Die Restzahlung ist erst nach der Fertigstellung fällig – ich schicke Ihnen dann eine Zahlungsaufforderung mit Link.",
    paidNote: "Die Auftragsarbeit ist vollständig bezahlt – jetzt bin ich an der Reihe.",
    viewOrder: "Bestellung ansehen",
    questions:
      "Wenn Sie an den Vorgaben noch etwas präzisieren möchten, schreiben Sie mir an info@keramickazahrada.cz – ich antworte persönlich.",
    closing: "Vielen Dank und herzliche Grüße",
  },
  en: {
    preview: (n) =>
      `The brief for your commission ${n} is confirmed — I'll let you know when I start work.`,
    eyebrow: "Commission",
    title: "Your brief is",
    accent: "confirmed.",
    intro: (n) =>
      `I've been through your brief${n ? ` for order ${n}` : ""} and everything is clear — I'm confirming your commission, and thank you for it. As soon as I start work, I'll send you an e-mail; until then there's nothing you need to do.`,
    imageAlt: "Your commission",
    commission: "Commission",
    agreedPrice: "Agreed price",
    depositPaid: "Paid as a deposit",
    balanceDue: "Balance due on completion",
    estimate: "Estimated completion",
    balanceNote:
      "You'll pay the remaining balance only once the piece is finished — I'll send you a request with a payment link.",
    paidNote: "Your commission is fully paid — now it's over to me.",
    viewOrder: "View order",
    questions:
      "If there's anything in the brief you'd like to clarify, just write to me at info@keramickazahrada.cz — I answer every e-mail myself.",
    closing: "Thank you — I'm looking forward to it,",
  },
}

/**
 * „Zadání potvrzeno" — potvrzení zadání zakázky (`confirm_specification`).
 *
 * Dřív se při potvrzení zadání posílalo „Výroba začíná" (order-processing),
 * i když se výroba ještě nerozběhla — a při „Začít výrobu" pak nepřišlo nic
 * (14. 10. 2026). Teď: potvrzení zadání = tenhle e-mail (co je domluvené,
 * kolik je zaplaceno a kolik zbude), začátek výroby = order-processing,
 * dokončení = commission-completed.
 */
function CommissionConfirmedEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
  productTitle,
  productImageUrl,
  totalPrice,
  depositPaid,
  balanceDue,
  estimatedCompletion,
}: CommissionConfirmedEmailProps) {
  const t = useCopy(COPY)
  const orderUrl = orderLink || storeLink()
  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(orderNumber)}</P>

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

      {productTitle ? <LedgerRow label={t.commission} value={productTitle} /> : null}
      {totalPrice ? <LedgerRow label={t.agreedPrice} value={totalPrice} /> : null}
      {depositPaid ? <LedgerRow label={t.depositPaid} value={depositPaid} /> : null}
      {balanceDue ? (
        <LedgerRow label={t.balanceDue} value={balanceDue} strong tone="olive" />
      ) : null}
      {estimatedCompletion ? (
        <LedgerRow label={t.estimate} value={estimatedCompletion} />
      ) : null}
      {productTitle || totalPrice || depositPaid || balanceDue || estimatedCompletion ? (
        <LedgerEnd />
      ) : null}

      <Note tone="olive">{balanceDue ? t.balanceNote : t.paidNote}</Note>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>{t.viewOrder}</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>{t.questions}</P>

      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const CommissionConfirmedEmail = (props: CommissionConfirmedEmailProps) => (
  <CommissionConfirmedEmailComponent {...props} />
)

// Mock data for preview/development
const mockCommissionConfirmed: CommissionConfirmedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#0050",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  productTitle: "Keramická plastika — Pán lesa Dub",
  productImageUrl:
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
  totalPrice: "4 500 Kč",
  depositPaid: "1 125 Kč",
  balanceDue: "3 375 Kč",
  estimatedCompletion: "5. 11. 2026",
}

export default () => <CommissionConfirmedEmailComponent {...mockCommissionConfirmed} />
