import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  MultiLine,
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
  contents: string
  before: string
  total: string
  viewOrder: string
  notYou: string
}> = {
  cs: {
    preview: (n) => `Úpravu objednávky ${n} mám uloženou.`,
    eyebrow: "Úprava objednávky",
    title: "Vaši úpravu",
    accent: "mám uloženou.",
    intro: (n) =>
      `vaši úpravu objednávky ${n} mám uloženou a dál se řídím už jen podle ní. Takhle teď objednávka vypadá:`,
    order: "Objednávka",
    contents: "Obsah",
    before: "Původně",
    total: "Celkem",
    viewOrder: "Zobrazit objednávku",
    notYou:
      "Pokud jste úpravu nedělali vy, napište mi prosím na info@keramickazahrada.cz — dám to do pořádku.",
  },
  sk: {
    preview: (n) => `Úpravu objednávky ${n} mám uloženú.`,
    eyebrow: "Úprava objednávky",
    title: "Vašu úpravu",
    accent: "mám uloženú.",
    intro: (n) =>
      `vašu úpravu objednávky ${n} mám uloženú a ďalej sa riadim už len podľa nej. Takto teraz objednávka vyzerá:`,
    order: "Objednávka",
    contents: "Obsah",
    before: "Pôvodne",
    total: "Celkom",
    viewOrder: "Zobraziť objednávku",
    notYou:
      "Ak ste úpravu nerobili vy, napíšte mi, prosím, na info@keramickazahrada.cz — dám to do poriadku.",
  },
  pl: {
    preview: (n) => `Zmiana zamówienia ${n} została zapisana.`,
    eyebrow: "Zmiana zamówienia",
    title: "Państwa zmiana",
    accent: "jest zapisana.",
    intro: (n) =>
      `Zapisałam zmianę zamówienia ${n} i od teraz kieruję się już tylko nią. Tak wygląda teraz zamówienie:`,
    order: "Zamówienie",
    contents: "Zawartość",
    before: "Pierwotnie",
    total: "Razem",
    viewOrder: "Zobacz zamówienie",
    notYou:
      "Jeśli to nie Państwo wprowadzili zmianę, proszę napisać na info@keramickazahrada.cz — wszystko naprawię.",
  },
  de: {
    preview: (n) => `Die Änderung von Bestellung ${n} ist gespeichert.`,
    eyebrow: "Bestelländerung",
    title: "Ihre Änderung",
    accent: "ist gespeichert.",
    intro: (n) =>
      `Ihre Änderung der Bestellung ${n} habe ich gespeichert und richte mich ab jetzt nur noch danach. So sieht die Bestellung jetzt aus:`,
    order: "Bestellung",
    contents: "Inhalt",
    before: "Vorher",
    total: "Gesamt",
    viewOrder: "Bestellung ansehen",
    notYou:
      "Falls Sie die Änderung nicht selbst vorgenommen haben, schreiben Sie mir bitte an info@keramickazahrada.cz – ich bringe das in Ordnung.",
  },
  en: {
    preview: (n) => `I've saved the changes to order ${n}.`,
    eyebrow: "Order change",
    title: "Your changes",
    accent: "are saved.",
    intro: (n) =>
      `I've saved the changes to your order ${n}, and from now on I'll go only by the updated version. This is how your order looks now:`,
    order: "Order",
    contents: "Contents",
    before: "Previously",
    total: "Total",
    viewOrder: "View order",
    notYou:
      "If you didn't make this change yourself, please write to me at info@keramickazahrada.cz — I'll put it right.",
  },
}

interface OrderEditedEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
  /** Nový obsah objednávky, řádek na položku („2× Hrnek · modrý"). */
  items?: string;
  totalBefore?: string;
  totalAfter?: string;
  /** Co se stane s penězi — stejná věta, jakou zákazník viděl v souhrnu. */
  moneySentence?: string;
}

/**
 * „Objednávka upravena" (docs/uprava-objednavky-plan.md §3d.11) — po každé
 * uložené zákaznické úpravě: hned, nebo po zaplacení rozdílu. Písemné
 * potvrzení, co si zákazník změnil a co to udělalo s cenou; zároveň pojistka,
 * kdyby úpravu neudělal on (odkaz z e-mailu může otevřít i někdo jiný).
 */
function OrderEditedEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
  items,
  totalBefore,
  totalAfter,
  moneySentence,
}: OrderEditedEmailProps) {
  const t = useCopy(COPY)
  const orderUrl = orderLink || storeLink()
  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(orderNumber)}</P>

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {items ? <LedgerRow label={t.contents} value={<MultiLine value={items} />} /> : null}
      {totalBefore && totalBefore !== totalAfter ? (
        <LedgerRow label={t.before} value={totalBefore} />
      ) : null}
      {totalAfter ? <LedgerRow label={t.total} value={totalAfter} strong /> : null}
      <LedgerEnd />

      {moneySentence ? <Note tone="olive">{moneySentence}</Note> : null}

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>{t.viewOrder}</EmailButton>
        </ButtonRow>
      ) : null}

      <P>{t.notYou}</P>

      <Signature />
    </EmailLayout>
  )
}

export const OrderEditedEmail = (props: OrderEditedEmailProps) => (
  <OrderEditedEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderEdited: OrderEditedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  items: "3× Dekorativní tyčky a zápichy\n1× Keramické pítko pro ptáčky",
  totalBefore: "1 130 Kč",
  totalAfter: "1 160 Kč",
}

export default () => <OrderEditedEmailComponent {...mockOrderEdited} />
