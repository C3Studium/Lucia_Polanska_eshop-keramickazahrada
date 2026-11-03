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
  introVoucher: (orderNumber: string) => string
  intro: (orderNumber: string) => string
  order: string
  place: string
  address: string
  hours: string
  readyFrom: string
  pickUpBy: string
  payOnSite: string
  payCashBefore: string
  payCash: (amount: string) => string
  payTransfer: (account: string, orderNumber: string) => string
  payAgree: string
  paid: string
  viewOrder: string
  arrange: string
  canWait: string
  defaultLocation: string
}> = {
  cs: {
    preview: (n) => `Objednávka ${n} je zabalená a čeká na vás v dílně.`,
    eyebrow: "Osobní odběr",
    title: "Zabaleno,",
    accent: "čeká na vás v dílně.",
    introVoucher: (n) =>
      `vaše objednávka ${n} je vyřízená — dárkový poukaz mám vytištěný a čeká na vás u mě v dílně. Kde a kdy si ho můžete vyzvednout, najdete níže.`,
    intro: (n) =>
      `vaši objednávku ${n} mám zabalenou a čeká na vás u mě v dílně. Kde a kdy si ji můžete vyzvednout, najdete níže.`,
    order: "Objednávka",
    place: "Místo",
    address: "Adresa",
    hours: "Otevírací doba",
    readyFrom: "Připraveno od",
    pickUpBy: "Vyzvednout do",
    payOnSite: "Zaplatíte na místě",
    payCashBefore: "Objednávku budete platit až při vyzvednutí — připravte si prosím",
    payCash: (a) => `${a} v hotovosti`,
    payTransfer: (acc, n) =>
      `, nebo mi částku pošlete převodem na účet ${acc} ještě před vyzvednutím (do zprávy pro příjemce napište ${n}).`,
    payAgree: ", nebo se se mnou předem domluvte na převodu na účet.",
    paid: "Objednávka je zaplacená, stačí si pro ni přijít.",
    viewOrder: "Zobrazit objednávku",
    arrange:
      "Termín vyzvednutí si prosím domluvíme — napište mi na info@keramickazahrada.cz nebo mi zavolejte. ",
    canWait: "Kdyby se vám to teď nehodilo, napište mi; objednávka u mě počká.",
    defaultLocation: "Dílna Keramická zahrada, Písek",
  },
  sk: {
    preview: (n) => `Objednávka ${n} je zabalená a čaká na vás v dielni.`,
    eyebrow: "Osobný odber",
    title: "Zabalené,",
    accent: "čaká na vás v dielni.",
    introVoucher: (n) =>
      `vaša objednávka ${n} je vybavená — darčekový poukaz mám vytlačený a čaká na vás u mňa v dielni. Kde a kedy si ho môžete vyzdvihnúť, nájdete nižšie.`,
    intro: (n) =>
      `vašu objednávku ${n} mám zabalenú a čaká na vás u mňa v dielni. Kde a kedy si ju môžete vyzdvihnúť, nájdete nižšie.`,
    order: "Objednávka",
    place: "Miesto",
    address: "Adresa",
    hours: "Otváracie hodiny",
    readyFrom: "Pripravené od",
    pickUpBy: "Vyzdvihnúť do",
    payOnSite: "Zaplatíte na mieste",
    payCashBefore: "Objednávku budete platiť až pri vyzdvihnutí — pripravte si, prosím,",
    payCash: (a) => `${a} v hotovosti`,
    payTransfer: (acc, n) =>
      `, alebo mi sumu pošlite prevodom na účet ${acc} ešte pred vyzdvihnutím (do správy pre príjemcu napíšte ${n}).`,
    payAgree: ", alebo sa so mnou vopred dohodnite na prevode na účet.",
    paid: "Objednávka je zaplatená, stačí si po ňu prísť.",
    viewOrder: "Zobraziť objednávku",
    arrange:
      "Termín vyzdvihnutia si, prosím, dohodneme — napíšte mi na info@keramickazahrada.cz alebo mi zavolajte. ",
    canWait: "Keby sa vám to teraz nehodilo, napíšte mi; objednávka u mňa počká.",
    defaultLocation: "Dielňa Keramická zahrada, Písek",
  },
  pl: {
    preview: (n) => `Zamówienie ${n} jest zapakowane i czeka na Państwa w pracowni.`,
    eyebrow: "Odbiór osobisty",
    title: "Zapakowane,",
    accent: "czeka na Państwa w pracowni.",
    introVoucher: (n) =>
      `Państwa zamówienie ${n} jest zrealizowane — bon podarunkowy jest wydrukowany i czeka u mnie w pracowni. Gdzie i kiedy można go odebrać, znajdą Państwo poniżej.`,
    intro: (n) =>
      `Państwa zamówienie ${n} jest zapakowane i czeka u mnie w pracowni. Gdzie i kiedy można je odebrać, znajdą Państwo poniżej.`,
    order: "Zamówienie",
    place: "Miejsce",
    address: "Adres",
    hours: "Godziny otwarcia",
    readyFrom: "Gotowe od",
    pickUpBy: "Odebrać do",
    payOnSite: "Do zapłaty na miejscu",
    payCashBefore: "Za zamówienie płacą Państwo dopiero przy odbiorze — proszę przygotować",
    payCash: (a) => `${a} w gotówce`,
    payTransfer: (acc, n) =>
      ` albo przesłać kwotę przelewem na konto ${acc} jeszcze przed odbiorem (w tytule przelewu proszę wpisać ${n}).`,
    payAgree: " albo wcześniej umówić się ze mną na przelew.",
    paid: "Zamówienie jest opłacone, wystarczy po nie przyjść.",
    viewOrder: "Zobacz zamówienie",
    arrange:
      "Termin odbioru ustalimy indywidualnie — proszę napisać na info@keramickazahrada.cz albo zadzwonić. ",
    canWait: "Jeśli teraz Państwu nie pasuje, proszę dać znać; zamówienie u mnie poczeka.",
    defaultLocation: "Pracownia Keramická zahrada, Písek",
  },
  de: {
    preview: (n) => `Bestellung ${n} ist verpackt und wartet in der Werkstatt auf Sie.`,
    eyebrow: "Selbstabholung",
    title: "Verpackt –",
    accent: "wartet in der Werkstatt auf Sie.",
    introVoucher: (n) =>
      `Ihre Bestellung ${n} ist erledigt – der Geschenkgutschein ist gedruckt und wartet bei mir in der Werkstatt. Wo und wann Sie ihn abholen können, finden Sie unten.`,
    intro: (n) =>
      `Ihre Bestellung ${n} ist verpackt und wartet bei mir in der Werkstatt. Wo und wann Sie sie abholen können, finden Sie unten.`,
    order: "Bestellung",
    place: "Ort",
    address: "Adresse",
    hours: "Öffnungszeiten",
    readyFrom: "Abholbereit ab",
    pickUpBy: "Abholen bis",
    payOnSite: "Zahlung vor Ort",
    payCashBefore: "Sie bezahlen die Bestellung erst bei der Abholung – bitte halten Sie",
    payCash: (a) => `${a} in bar bereit`,
    payTransfer: (acc, n) =>
      ` oder überweisen Sie mir den Betrag noch vor der Abholung auf das Konto ${acc} (Verwendungszweck: ${n}).`,
    payAgree: " oder vereinbaren Sie vorab mit mir eine Überweisung.",
    paid: "Die Bestellung ist bezahlt – Sie müssen sie nur noch abholen.",
    viewOrder: "Bestellung ansehen",
    arrange:
      "Den Abholtermin vereinbaren wir gern individuell – schreiben Sie mir an info@keramickazahrada.cz oder rufen Sie mich an. ",
    canWait: "Wenn es Ihnen gerade nicht passt, sagen Sie mir Bescheid; die Bestellung wartet bei mir.",
    defaultLocation: "Werkstatt Keramická zahrada, Písek",
  },
  en: {
    preview: (n) => `Order ${n} is packed and waiting for you at the studio.`,
    eyebrow: "Collection in person",
    title: "All packed,",
    accent: "waiting for you at the studio.",
    introVoucher: (n) =>
      `Your order ${n} is ready — I've printed your gift voucher and it's waiting for you at my studio. You'll find where and when to collect it below.`,
    intro: (n) =>
      `Your order ${n} is packed and waiting for you at my studio. You'll find where and when to collect it below.`,
    order: "Order",
    place: "Place",
    address: "Address",
    hours: "Opening hours",
    readyFrom: "Ready from",
    pickUpBy: "Collect by",
    payOnSite: "To pay on collection",
    payCashBefore: "You'll pay for the order when you collect it — please bring",
    payCash: (a) => `${a} in cash`,
    payTransfer: (acc, n) =>
      `, or send me the amount by bank transfer to account ${acc} before you come (please use ${n} as the payment reference).`,
    payAgree: ", or let me know in advance if you'd prefer to pay by bank transfer.",
    paid: "Your order is paid — just come and pick it up.",
    viewOrder: "View order",
    arrange:
      "Let's arrange a time for you to collect it — write to me at info@keramickazahrada.cz or give me a call. ",
    canWait: "If now isn't a good time, just let me know; your order can wait for you here.",
    defaultLocation: "Keramická zahrada studio, Písek",
  },
}

interface OrderReadyPickupEmailProps {
  customerName?: string;
  orderNumber?: string;
  pickupLocation?: string;
  pickupAddress?: string;
  pickupHours?: string;
  readyDate?: string;
  pickupDeadline?: string;
  orderLink?: string;
  pickupInstructions?: string;
  /** Co se platí až na místě; `null`, když je objednávka zaplacená. */
  amountDue?: string | null;
  /** Číslo účtu z Právních údajů — jen když ho majitelka vyplnila. */
  bankAccount?: string | null;
  /** V objednávce je vytištěný dárkový poukaz — ten se jen vyzvedává. */
  printedVoucher?: boolean;
}

/**
 * Řádky s otevírací dobou, termínem a datem se vykreslí jen s reálnými daty —
 * ateliér nemá pevnou otevírací dobu ani lhůtu, vyzvednutí se domlouvá,
 * a vymyšlená výchozí hodnota v e-mailu by byla horší než žádná.
 */
function OrderReadyPickupEmailComponent({
  customerName,
  orderNumber = "",
  pickupLocation,
  pickupAddress = "Putim 229, 397 01 Písek",
  pickupHours,
  readyDate,
  pickupDeadline,
  orderLink = "",
  pickupInstructions,
  amountDue,
  bankAccount,
  printedVoucher = false
}: OrderReadyPickupEmailProps) {
  const t = useCopy(COPY)
  const orderUrl = orderLink || storeLink()
  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{printedVoucher ? t.introVoucher(orderNumber) : t.intro(orderNumber)}</P>

      <LedgerRow label={t.order} value={orderNumber} />
      <LedgerRow label={t.place} value={pickupLocation || t.defaultLocation} strong />
      <LedgerRow label={t.address} value={pickupAddress} />
      {pickupHours ? (
        <LedgerRow label={t.hours} value={pickupHours} />
      ) : null}
      {readyDate ? <LedgerRow label={t.readyFrom} value={readyDate} /> : null}
      {pickupDeadline ? (
        <LedgerRow label={t.pickUpBy} value={pickupDeadline} tone="clay" />
      ) : null}
      {amountDue ? (
        <LedgerRow label={t.payOnSite} value={amountDue} tone="clay" strong />
      ) : null}
      <LedgerEnd />

      {/*
        Osobní odběr se platí až u pultu, a ateliér není obchod s terminálem:
        bez téhle věty zákazník přijel s kartou a nebylo čím zaplatit
        (30. 10. 2026). Účet jen tehdy, když je v Právních údajích vyplněný.
      */}
      {amountDue ? (
        <Note tone="clay">
          {t.payCashBefore} {t.payCash(amountDue)}
          {bankAccount ? t.payTransfer(bankAccount, orderNumber) : t.payAgree}
        </Note>
      ) : (
        <Note tone="olive">{t.paid}</Note>
      )}

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>{t.viewOrder}</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        {pickupInstructions ? `${pickupInstructions} ` : t.arrange}
        {t.canWait}
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const OrderReadyPickupEmail = (props: OrderReadyPickupEmailProps) => (
  <OrderReadyPickupEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderReadyPickup: OrderReadyPickupEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  pickupAddress: "Putim 229, 397 01 Písek",
  readyDate: "2. 11. 2026",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  // Náhled ukazuje ten horší případ — nezaplacenou objednávku.
  amountDue: "1 290 Kč",
  bankAccount: "1234567890/2010",
}

export default () => <OrderReadyPickupEmailComponent {...mockOrderReadyPickup} />
