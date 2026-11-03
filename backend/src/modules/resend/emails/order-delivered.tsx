import { Link } from "@react-email/components"
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

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: (orderNumber: string) => string
  eyebrow: (orderNumber: string) => string
  title: string
  accent: string
  intro: (orderNumber: string) => string
  order: string
  thanks: string
  care: string
  browse: string
  damagedHeading: string
  damagedText: (orderNumber: string) => string
  claimOnline: string
  withdrawalBefore: string
  withdrawalLink: string
  closing: string
}> = {
  cs: {
    preview: (n) => `Objednávka ${n} je u vás — děkuji za důvěru.`,
    eyebrow: (n) => `Objednávka ${n}`,
    title: "Vaše kousky",
    accent: "jsou u vás.",
    intro: (n) =>
      `vaše objednávka ${n} je u vás a z mé strany tím vyřízená. Přeji si, aby vám kousky dělaly radost — v zahradě i doma.`,
    order: "Objednávka",
    thanks: "Děkuji, že jste si vybrali keramiku z mé dílny.",
    care:
      "Kdybyste s kousky potřebovali cokoli poradit — třeba jak o ně pečovat — napište mi na info@keramickazahrada.cz, odpovídám sama.",
    browse: "Prohlédnout další kousky",
    damagedHeading: "Dorazila zásilka poškozená?",
    damagedText: (n) =>
      ` Napište mi prosím${n ? ` (objednávka ${n})` : ""} a přiložte fotky obalu i zboží — poškozený kousek vyměním nebo vám vrátím peníze a s dopravcem si to vyřídím sama. Obal si prosím schovejte, dokud se vám neozvu.`,
    claimOnline: "Reklamaci můžete podat i online:",
    withdrawalBefore:
      "Od kupní smlouvy můžete odstoupit bez udání důvodu do 14 dnů od převzetí zboží, online přes tlačítko",
    withdrawalLink: "Odstoupit od smlouvy",
    closing: "Mějte se krásně,",
  },
  sk: {
    preview: (n) => `Objednávka ${n} je u vás — ďakujem za dôveru.`,
    eyebrow: (n) => `Objednávka ${n}`,
    title: "Vaše kúsky",
    accent: "sú u vás.",
    intro: (n) =>
      `vaša objednávka ${n} je u vás a z mojej strany je tým vybavená. Želám si, aby vám kúsky robili radosť — v záhrade aj doma.`,
    order: "Objednávka",
    thanks: "Ďakujem, že ste si vybrali keramiku z mojej dielne.",
    care:
      "Keby ste s kúskami potrebovali s čímkoľvek poradiť — napríklad ako sa o ne starať — napíšte mi na info@keramickazahrada.cz, odpovedám sama.",
    browse: "Pozrieť ďalšie kúsky",
    damagedHeading: "Dorazila zásielka poškodená?",
    damagedText: (n) =>
      ` Napíšte mi, prosím,${n ? ` (objednávka ${n})` : ""} a priložte fotky obalu aj tovaru — poškodený kúsok vymením alebo vám vrátim peniaze a s prepravcom si to vybavím sama. Obal si, prosím, odložte, kým sa vám neozvem.`,
    claimOnline: "Reklamáciu môžete podať aj online:",
    withdrawalBefore:
      "Od kúpnej zmluvy môžete odstúpiť bez uvedenia dôvodu do 14 dní od prevzatia tovaru, online cez tlačidlo",
    withdrawalLink: "Odstúpiť od zmluvy",
    closing: "Majte sa krásne,",
  },
  pl: {
    preview: (n) => `Zamówienie ${n} jest już u Państwa — dziękuję za zaufanie.`,
    eyebrow: (n) => `Zamówienie ${n}`,
    title: "Ceramika",
    accent: "jest już u Państwa.",
    intro: (n) =>
      `Zamówienie ${n} jest już u Państwa i z mojej strony zostało tym samym zrealizowane. Mam nadzieję, że ceramika będzie cieszyć — w ogrodzie i w domu.`,
    order: "Zamówienie",
    thanks: "Dziękuję, że wybrali Państwo ceramikę z mojej pracowni.",
    care:
      "Gdyby potrzebowali Państwo jakiejkolwiek porady — na przykład jak dbać o ceramikę — proszę napisać na info@keramickazahrada.cz, odpowiadam osobiście.",
    browse: "Zobacz inne wyroby",
    damagedHeading: "Przesyłka dotarła uszkodzona?",
    damagedText: (n) =>
      ` Proszę do mnie napisać${n ? ` (zamówienie ${n})` : ""} i dołączyć zdjęcia opakowania oraz towaru — uszkodzony egzemplarz wymienię albo zwrócę pieniądze, a sprawę z przewoźnikiem załatwię sama. Proszę zachować opakowanie, dopóki się nie odezwę.`,
    claimOnline: "Reklamację można złożyć także online:",
    withdrawalBefore:
      "Od umowy sprzedaży można odstąpić bez podania przyczyny w ciągu 14 dni od otrzymania towaru, online przyciskiem",
    withdrawalLink: "Odstąpienie od umowy",
    closing: "Wszystkiego dobrego",
  },
  de: {
    preview: (n) => `Bestellung ${n} ist bei Ihnen – danke für Ihr Vertrauen.`,
    eyebrow: (n) => `Bestellung ${n}`,
    title: "Ihre Stücke",
    accent: "sind bei Ihnen.",
    intro: (n) =>
      `Ihre Bestellung ${n} ist bei Ihnen angekommen und damit von meiner Seite abgeschlossen. Ich wünsche Ihnen viel Freude damit – im Garten wie im Haus.`,
    order: "Bestellung",
    thanks: "Danke, dass Sie sich für Keramik aus meiner Werkstatt entschieden haben.",
    care:
      "Wenn Sie zu den Stücken einen Rat brauchen – etwa zur Pflege –, schreiben Sie mir an info@keramickazahrada.cz, ich antworte persönlich.",
    browse: "Weitere Stücke ansehen",
    damagedHeading: "Ist das Paket beschädigt angekommen?",
    damagedText: (n) =>
      ` Schreiben Sie mir bitte${n ? ` (Bestellung ${n})` : ""} und schicken Sie Fotos von Verpackung und Ware mit – ein beschädigtes Stück tausche ich aus oder erstatte Ihnen den Betrag, die Sache mit dem Versanddienst kläre ich selbst. Bitte heben Sie die Verpackung auf, bis Sie von mir hören.`,
    claimOnline: "Eine Reklamation können Sie auch online einreichen:",
    withdrawalBefore:
      "Sie können innerhalb von 14 Tagen nach Erhalt der Ware ohne Angabe von Gründen vom Kaufvertrag zurücktreten – online über die Schaltfläche",
    withdrawalLink: "Vom Vertrag zurücktreten",
    closing: "Alles Gute und herzliche Grüße",
  },
  en: {
    preview: (n) => `Order ${n} has arrived — thank you for your trust.`,
    eyebrow: (n) => `Order ${n}`,
    title: "Your pieces",
    accent: "have arrived.",
    intro: (n) =>
      `Your order ${n} is with you, and that completes it on my side. I hope your pieces bring you joy — in the garden and at home.`,
    order: "Order",
    thanks: "Thank you for choosing ceramics from my studio.",
    care:
      "If you ever need any advice about your pieces — how to look after them, for example — write to me at info@keramickazahrada.cz; I answer every message myself.",
    browse: "Browse more pieces",
    damagedHeading: "Did the parcel arrive damaged?",
    damagedText: (n) =>
      ` Please write to me${n ? ` (order ${n})` : ""} and attach photos of the packaging and the goods — I'll replace the damaged piece or refund you, and I'll sort things out with the courier myself. Please keep the packaging until you hear back from me.`,
    claimOnline: "You can also make a complaint online:",
    withdrawalBefore:
      "You can withdraw from the purchase contract without giving any reason within 14 days of receiving the goods, online using the button",
    withdrawalLink: "Withdraw from the contract",
    closing: "All the very best,",
  },
}

interface OrderDeliveredEmailProps {
  /** Storefront page with the claim block (reklamace z e-mailu). */
  claimUrl?: string;
  customerName?: string;
  orderNumber?: string;
  /**
   * True only when the objects travelled with a carrier. The one live send
   * site (`delivery.created` in subscribers/customer-emails.ts) fires for
   * personal pickups — the customer held the piece in their hands, so a
   * „poškozená zásilka" claim block would talk about a parcel that never
   * existed. The carrier-damage flow stays available for a future
   * courier-delivery send site via this flag.
   */
  shippedByCarrier?: boolean;
  /**
   * Podepsaný odkaz na „Odstoupit od smlouvy" (`/order/:id/odstoupeni`,
   * § 1830a OZ) — převzetím začíná 14denní lhůta. Prázdný u čisté zakázky
   * (§ 1837 písm. d) → odstavec se nevykreslí.
   */
  withdrawalUrl?: string;
}

/**
 * Sent when a personal-pickup order's shipment is created — the objects have
 * been handed over, the order is complete. No address talk: nothing was posted.
 *
 * Poškozená zásilka (14. 10. 2026, právní audit §4.1): zákazník hlásí
 * poškození NÁM (fotky vítány, obal schovat); s dopravcem to řeší prodávající.
 * Dřívější `CarrierDamageClaim` („reklamaci u České pošty podává příjemce,
 * jen dva pracovní dny") z lhůty dopravce dělal podmínku reklamace.
 */
function OrderDeliveredEmailComponent({
  customerName,
  orderNumber = "",
  claimUrl,
  shippedByCarrier = false,
  withdrawalUrl = "",
}: OrderDeliveredEmailProps) {
  const t = useCopy(COPY)
  const shopUrl = storeLink()
  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow(orderNumber)}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(orderNumber)}</P>

      {orderNumber ? (
        <>
          <LedgerRow label={t.order} value={orderNumber} strong />
          <LedgerEnd />
        </>
      ) : null}

      <Note tone="olive">{t.thanks}</Note>

      <P>{t.care}</P>

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl}>{t.browse}</EmailButton>
        </ButtonRow>
      ) : null}
      {/* Carrier deliveries only. Poškození hlásí zákazník nám — žádná lhůta
          dopravce, žádný formulář pošty jako podmínka. */}
      {shippedByCarrier ? (
        <>
          <P>
            <strong>{t.damagedHeading}</strong>
            {t.damagedText(orderNumber)}
          </P>
          {claimUrl ? (
            <P>
              {t.claimOnline}{" "}
              <Link href={claimUrl} style={{ color: brand.clay }}>
                {claimUrl}
              </Link>
            </P>
          ) : null}
        </>
      ) : null}

      {/* § 1830a OZ — odstoupení online i pro hosta bez účtu. */}
      {withdrawalUrl ? (
        <P small>
          {t.withdrawalBefore}{" "}
          <Link href={withdrawalUrl} style={{ color: brand.clay }}>
            {t.withdrawalLink}
          </Link>
          .
        </P>
      ) : null}

      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const OrderDeliveredEmail = (props: OrderDeliveredEmailProps) => (
  <OrderDeliveredEmailComponent {...props} />
);

// Mock data for preview/development
const mockOrderDelivered: OrderDeliveredEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  shippedByCarrier: true,
  claimUrl: "https://keramickazahrada.cz/cz/order/order_12345/refund?token=abc",
  withdrawalUrl: "https://keramickazahrada.cz/cz/order/order_12345/odstoupeni?token=abc",
};

export default () => <OrderDeliveredEmailComponent {...mockOrderDelivered} />;
