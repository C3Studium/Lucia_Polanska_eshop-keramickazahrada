import { Link } from "@react-email/components"
import {
  brand,
  ButtonRow,
  CONTACT_EMAIL,
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
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  previewCheckout: string
  preview: (orderNumber: string) => string
  eyebrow: string
  title: string
  accent: string
  introCheckout: string
  intro: string
  order: string
  reason: string
  amount: string
  cartHeading: string
  paidForHeading: string
  nothingCharged: string
  finishOrder: string
  retry: string
  helpBefore: string
  helpAfter: string
}> = {
  cs: {
    previewCheckout: "Platba neprošla — košík vám zůstal uložený, stačí ji zopakovat.",
    preview: (n) => `Platba za objednávku ${n} neprošla — můžete ji v klidu zopakovat.`,
    eyebrow: "Platba",
    title: "Platba",
    accent: "neprošla.",
    introCheckout:
      "platbu se nepodařilo dokončit, a tak objednávka zatím nevznikla. Nic se neděje — košík vám zůstal uložený, stačí se vrátit a platbu zopakovat.",
    intro:
      "platbu za vaši objednávku se nepodařilo dokončit. Nic se neztratilo — objednávku vám podržím a platbu můžete zopakovat, až se vám to bude hodit.",
    order: "Objednávka",
    reason: "Důvod",
    amount: "Částka",
    cartHeading: "Co máte v košíku",
    paidForHeading: "Za co platba byla",
    nothingCharged: "Z vašeho účtu se nic nestrhlo — platba vůbec neproběhla.",
    finishOrder: "Dokončit objednávku",
    retry: "Zopakovat platbu",
    helpBefore: "Kdyby se platba nedařila ani napodruhé, napište mi na",
    helpAfter: "a vyřešíme to spolu.",
  },
  sk: {
    previewCheckout: "Platba neprešla — košík vám zostal uložený, stačí ju zopakovať.",
    preview: (n) => `Platba za objednávku ${n} neprešla — môžete ju pokojne zopakovať.`,
    eyebrow: "Platba",
    title: "Platba",
    accent: "neprešla.",
    introCheckout:
      "platbu sa nepodarilo dokončiť, a tak objednávka zatiaľ nevznikla. Nič sa nedeje — košík vám zostal uložený, stačí sa vrátiť a platbu zopakovať.",
    intro:
      "platbu za vašu objednávku sa nepodarilo dokončiť. Nič sa nestratilo — objednávku vám podržím a platbu môžete zopakovať, keď sa vám to bude hodiť.",
    order: "Objednávka",
    reason: "Dôvod",
    amount: "Suma",
    cartHeading: "Čo máte v košíku",
    paidForHeading: "Za čo bola platba",
    nothingCharged: "Z vášho účtu sa nič nestiahlo — platba vôbec neprebehla.",
    finishOrder: "Dokončiť objednávku",
    retry: "Zopakovať platbu",
    helpBefore: "Keby platba nevyšla ani na druhý raz, napíšte mi na",
    helpAfter: "a vyriešime to spolu.",
  },
  pl: {
    previewCheckout: "Płatność nie przeszła — koszyk został zapisany, wystarczy ją powtórzyć.",
    preview: (n) => `Płatność za zamówienie ${n} nie przeszła — można ją spokojnie powtórzyć.`,
    eyebrow: "Płatność",
    title: "Płatność",
    accent: "nie przeszła.",
    introCheckout:
      "Nie udało się dokończyć płatności, dlatego zamówienie jeszcze nie powstało. Nic się nie stało — koszyk został zapisany, wystarczy wrócić i powtórzyć płatność.",
    intro:
      "Nie udało się dokończyć płatności za Państwa zamówienie. Nic nie przepadło — zatrzymam zamówienie, a płatność mogą Państwo powtórzyć w dogodnej chwili.",
    order: "Zamówienie",
    reason: "Przyczyna",
    amount: "Kwota",
    cartHeading: "Co jest w koszyku",
    paidForHeading: "Czego dotyczyła płatność",
    nothingCharged: "Z Państwa konta nic nie zostało pobrane — płatność w ogóle się nie odbyła.",
    finishOrder: "Dokończ zamówienie",
    retry: "Powtórz płatność",
    helpBefore: "Gdyby płatność nie udała się także za drugim razem, proszę napisać na",
    helpAfter: "— razem to rozwiążemy.",
  },
  de: {
    previewCheckout:
      "Die Zahlung hat nicht geklappt – Ihr Warenkorb ist gespeichert, Sie können sie einfach wiederholen.",
    preview: (n) =>
      `Die Zahlung für Bestellung ${n} hat nicht geklappt – Sie können sie in Ruhe wiederholen.`,
    eyebrow: "Zahlung",
    title: "Die Zahlung",
    accent: "hat nicht geklappt.",
    introCheckout:
      "die Zahlung konnte nicht abgeschlossen werden, deshalb ist noch keine Bestellung entstanden. Kein Problem – Ihr Warenkorb ist gespeichert, Sie müssen nur zurückkehren und die Zahlung wiederholen.",
    intro:
      "die Zahlung für Ihre Bestellung konnte nicht abgeschlossen werden. Es ist nichts verloren – ich halte die Bestellung für Sie zurück, und Sie können die Zahlung wiederholen, wann es Ihnen passt.",
    order: "Bestellung",
    reason: "Grund",
    amount: "Betrag",
    cartHeading: "Was in Ihrem Warenkorb liegt",
    paidForHeading: "Wofür die Zahlung war",
    nothingCharged: "Von Ihrem Konto wurde nichts abgebucht – die Zahlung hat gar nicht stattgefunden.",
    finishOrder: "Bestellung abschließen",
    retry: "Zahlung wiederholen",
    helpBefore: "Falls die Zahlung auch beim zweiten Versuch nicht klappt, schreiben Sie mir an",
    helpAfter: "– wir lösen das gemeinsam.",
  },
  en: {
    previewCheckout: "Your payment didn't go through — your basket is saved, so you can simply try again.",
    preview: (n) => `The payment for order ${n} didn't go through — you can try again whenever suits you.`,
    eyebrow: "Payment",
    title: "Your payment",
    accent: "didn't go through.",
    introCheckout:
      "The payment couldn't be completed, so your order hasn't been placed yet. Don't worry — your basket is saved, so just come back and try the payment again.",
    intro:
      "The payment for your order couldn't be completed. Nothing is lost — I'll hold your order for you, and you can try the payment again whenever it suits you.",
    order: "Order",
    reason: "Reason",
    amount: "Amount",
    cartHeading: "What's in your basket",
    paidForHeading: "What the payment was for",
    nothingCharged: "Nothing has been taken from your account — the payment didn't go through at all.",
    finishOrder: "Complete your order",
    retry: "Try the payment again",
    helpBefore: "If the payment doesn't work the second time either, write to me at",
    helpAfter: "and we'll sort it out together.",
  },
}

interface PaymentFailedEmailProps {
  customerName?: string;
  orderNumber?: string;
  paymentAmount?: string;
  /**
   * Čeho se nezdařená platba týkala — položky košíku nebo objednávky
   * (`lib/email-items`). Bez nich e-mail mluví o penězích a neřekne za co.
   */
  paidFor?: EmailLineItem[] | null;
  /** Only when the payment provider actually said one — no guessed default. */
  failureReason?: string;
  retryLink?: string;
  supportEmail?: string;
  /**
   * Platba z pokladny — objednávka ještě nevznikla (bez čísla), odkaz obnoví
   * košík a vede na krok platby. Bez toho jde o objednávku nebo doplatek.
   */
  checkout?: boolean;
}

/**
 * Důvod, částka i tlačítko se vykreslí jen s reálnými daty — vymyšlený
 * výchozí důvod („nedostatečné prostředky") by obviňoval kartu zákazníka
 * za něco, co se třeba vůbec nestalo.
 */
function PaymentFailedEmailComponent({
  customerName,
  orderNumber = "",
  paymentAmount,
  paidFor,
  failureReason,
  retryLink = "",
  supportEmail = CONTACT_EMAIL,
  checkout = false,
}: PaymentFailedEmailProps) {
  const t = useCopy(COPY)
  return (
    <EmailLayout preview={checkout ? t.previewCheckout : t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{checkout ? t.introCheckout : t.intro}</P>

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {failureReason ? <LedgerRow label={t.reason} value={failureReason} /> : null}
      {paymentAmount ? (
        <LedgerRow label={t.amount} value={paymentAmount} strong tone="danger" />
      ) : null}
      <LedgerEnd />

      {/* Čeho se platba týkala — u „neprošla" obzvlášť: zákazník má řešit
          peníze a bez výpisu neví za co. U pokladny je to obsah košíku,
          který mu odkaz obnoví. */}
      <PaidFor items={paidFor} heading={checkout ? t.cartHeading : t.paidForHeading} />

      <Note tone="danger">{t.nothingCharged}</Note>

      {retryLink ? (
        <ButtonRow>
          <EmailButton href={retryLink}>{checkout ? t.finishOrder : t.retry}</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        {t.helpBefore}{" "}
        <Link
          href={`mailto:${supportEmail}`}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          {supportEmail}
        </Link>
        {" "}{t.helpAfter}
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const PaymentFailedEmail = (props: PaymentFailedEmailProps) => (
  <PaymentFailedEmailComponent {...props} />
)

// Mock data for preview/development
const mockPaymentFailed: PaymentFailedEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  paymentAmount: "2 450 Kč",
  failureReason: "Karta zamítnuta bankou",
  retryLink: "https://keramickazahrada.cz/checkout/retry/12345",
  supportEmail: "info@keramickazahrada.cz",
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
  ],
}

export default () => <PaymentFailedEmailComponent {...mockPaymentFailed} />
