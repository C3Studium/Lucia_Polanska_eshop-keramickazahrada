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
    preview: (n) => `Objednávku ${n} právě balím.`,
    eyebrow: "Objednávka",
    title: "Vaši objednávku",
    accent: "právě balím.",
    intro: (n) =>
      `vaši objednávku ${n} jsem vzala do ruky a balím ji. Každý kousek ještě prohlédnu a zabalím tak, aby cestu zvládl bez úhony. Jakmile objednávku předám dopravci, napíšu vám znovu.`,
    order: "Objednávka",
    note: "Balím a kontroluji každý kousek sama.",
    viewOrder: "Zobrazit objednávku",
  },
  sk: {
    preview: (n) => `Objednávku ${n} práve balím.`,
    eyebrow: "Objednávka",
    title: "Vašu objednávku",
    accent: "práve balím.",
    intro: (n) =>
      `vašu objednávku ${n} som vzala do rúk a balím ju. Každý kúsok si ešte prezriem a zabalím tak, aby cestu zvládol bez úhony. Hneď ako objednávku odovzdám prepravcovi, napíšem vám znova.`,
    order: "Objednávka",
    note: "Každý kúsok balím a kontrolujem sama.",
    viewOrder: "Zobraziť objednávku",
  },
  pl: {
    preview: (n) => `Właśnie pakuję zamówienie ${n}.`,
    eyebrow: "Zamówienie",
    title: "Państwa zamówienie",
    accent: "właśnie pakuję.",
    intro: (n) =>
      `Zajęłam się Państwa zamówieniem ${n} i właśnie je pakuję. Każdy egzemplarz jeszcze raz obejrzę i zapakuję tak, żeby bezpiecznie przetrwał podróż. Gdy tylko przekażę zamówienie przewoźnikowi, znów się odezwę.`,
    order: "Zamówienie",
    note: "Każdy egzemplarz pakuję i sprawdzam osobiście.",
    viewOrder: "Zobacz zamówienie",
  },
  de: {
    preview: (n) => `Ich packe gerade Ihre Bestellung ${n}.`,
    eyebrow: "Bestellung",
    title: "Ihre Bestellung",
    accent: "packe ich gerade.",
    intro: (n) =>
      `ich habe Ihre Bestellung ${n} in die Hand genommen und packe sie gerade. Jedes Stück sehe ich mir noch einmal an und verpacke es so, dass es die Reise unbeschadet übersteht. Sobald ich die Bestellung dem Versanddienst übergeben habe, melde ich mich wieder.`,
    order: "Bestellung",
    note: "Jedes Stück packe und prüfe ich selbst.",
    viewOrder: "Bestellung ansehen",
  },
  en: {
    preview: (n) => `I'm packing your order ${n} right now.`,
    eyebrow: "Order",
    title: "I'm packing",
    accent: "your order right now.",
    intro: (n) =>
      `I've picked up your order ${n} and I'm packing it now. I give every piece one last look and wrap it carefully so it makes the journey safe and sound. As soon as I've handed the order over to the courier, I'll write to you again.`,
    order: "Order",
    note: "I pack and check every piece myself.",
    viewOrder: "View order",
  },
}

interface OrderPreparingEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
}

/**
 * Sent when a merchant moves an ordinary (in-stock) order into the
 * „Připravujeme" stage — the objects are being packed for dispatch. This is
 * NOT the made-to-order „Výroba začíná" (that is order-processing); here
 * nothing is being made, the order is simply taken in hand and readied to ship.
 */
function OrderPreparingEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = ""
}: OrderPreparingEmailProps) {
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

export const OrderPreparingEmail = (props: OrderPreparingEmailProps) => (
  <OrderPreparingEmailComponent {...props} />
);

// Mock data for preview/development
const mockOrderPreparing: OrderPreparingEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  orderLink: "https://keramickazahrada.cz/orders/12345",
};

export default () => <OrderPreparingEmailComponent {...mockOrderPreparing} />;
