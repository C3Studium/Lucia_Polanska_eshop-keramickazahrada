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
  Signature,
} from "../components/email-ui"
import { storeLink } from "../../../lib/storefront-url"
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/**
 * Texty po jazycích (lib/email-locale) — čeština je původní znění.
 * `commission` přepíná „zakázka" / „objednávka": v polštině a slovenštině
 * se mění i tvar slovesa a přídavného jména, proto celé věty, ne jen slovo.
 */
const COPY: Localized<{
  preview: (commission: boolean, orderNumber: string) => string
  eyebrow: (commission: boolean, orderNumber: string) => string
  title: string
  accent: (commission: boolean) => string
  intro: (commission: boolean, orderNumber: string) => string
  stillMakingOne: string
  stillMakingMany: string
  sendWhole: (many: boolean) => string
  noun: (commission: boolean) => string
  product: string
  originalDate: string
  newDate: string
  reason: string
  note: string
  compensation: (offer: string) => string
  track: string
  viewOrder: string
  questions: string
  closing: string
  soon: string
}> = {
  cs: {
    preview: (c, n) => `${c ? "Zakázka" : "Objednávka"} ${n} se zdrží — omlouvám se a děkuji za trpělivost.`,
    eyebrow: (c, n) => `${c ? "Zakázka" : "Objednávka"} ${n}`,
    title: "Omlouvám se,",
    accent: (c) => `${c ? "zakázka" : "objednávka"} se zdrží.`,
    intro: (c, n) =>
      `omlouvám se — vaše ${c ? "zakázka" : "objednávka"} ${n} se zdrží. Ruční výroba má svůj rytmus a tentokrát si vyžádala víc času, než jsem počítala. Nový termín najdete níže; kdyby vám nevyhovoval, napište mi a domluvíme se, co dál.`,
    stillMakingOne: "Ještě dodělávám tenhle kousek:",
    stillMakingMany: "Ještě dodělávám tyhle kousky:",
    sendWhole: (many) =>
      `Objednávku vám pošlu celou, jakmile ${many ? "budou hotové" : "bude hotový"}. Kdybyste chtěli zbytek poslat dřív, napište mi.`,
    noun: (c) => (c ? "Zakázka" : "Objednávka"),
    product: "Výrobek",
    originalDate: "Původní termín",
    newDate: "Nový termín",
    reason: "Důvod",
    note: "Raději pořádně než rychle — děkuji, že mi dáte ten čas.",
    compensation: (o) => `Jako poděkování za trpělivost jsem pro vás připravila: ${o}.`,
    track: "Sledovat objednávku",
    viewOrder: "Zobrazit objednávku",
    questions: "Kdybyste chtěli cokoli vědět, napište mi na",
    closing: "Děkuji za trpělivost,",
    soon: "co nevidět",
  },
  sk: {
    preview: (c, n) =>
      `${c ? "Zákazka" : "Objednávka"} ${n} sa oneskorí — ospravedlňujem sa a ďakujem za trpezlivosť.`,
    eyebrow: (c, n) => `${c ? "Zákazka" : "Objednávka"} ${n}`,
    title: "Ospravedlňujem sa,",
    accent: (c) => `${c ? "zákazka" : "objednávka"} sa oneskorí.`,
    intro: (c, n) =>
      `ospravedlňujem sa — vaša ${c ? "zákazka" : "objednávka"} ${n} sa oneskorí. Ručná výroba má svoj rytmus a tentoraz si vyžiadala viac času, než som rátala. Nový termín nájdete nižšie; keby vám nevyhovoval, napíšte mi a dohodneme sa, čo ďalej.`,
    stillMakingOne: "Ešte dokončujem tento kúsok:",
    stillMakingMany: "Ešte dokončujem tieto kúsky:",
    sendWhole: (many) =>
      `Objednávku vám pošlem celú, hneď ako ${many ? "budú hotové" : "bude hotový"}. Keby ste chceli zvyšok poslať skôr, napíšte mi.`,
    noun: (c) => (c ? "Zákazka" : "Objednávka"),
    product: "Výrobok",
    originalDate: "Pôvodný termín",
    newDate: "Nový termín",
    reason: "Dôvod",
    note: "Radšej poriadne ako rýchlo — ďakujem, že mi dáte ten čas.",
    compensation: (o) => `Ako poďakovanie za trpezlivosť som pre vás pripravila: ${o}.`,
    track: "Sledovať objednávku",
    viewOrder: "Zobraziť objednávku",
    questions: "Keby ste chceli čokoľvek vedieť, napíšte mi na",
    closing: "Ďakujem za trpezlivosť,",
    soon: "čoskoro",
  },
  pl: {
    preview: (c, n) =>
      `${c ? "Zamówienie indywidualne" : "Zamówienie"} ${n} się opóźni — przepraszam i dziękuję za cierpliwość.`,
    eyebrow: (c, n) => `${c ? "Zamówienie indywidualne" : "Zamówienie"} ${n}`,
    title: "Przepraszam,",
    accent: (c) => `${c ? "zamówienie indywidualne" : "zamówienie"} się opóźni.`,
    intro: (c, n) =>
      `Przepraszam — Państwa ${c ? "zamówienie indywidualne" : "zamówienie"} ${n} się opóźni. Ręczna praca ma swój rytm i tym razem wymagała więcej czasu, niż zakładałam. Nowy termin znajdą Państwo poniżej; jeśli nie odpowiada, proszę napisać — ustalimy, co dalej.`,
    stillMakingOne: "Jeszcze kończę ten egzemplarz:",
    stillMakingMany: "Jeszcze kończę te egzemplarze:",
    sendWhole: (many) =>
      `Wyślę całe zamówienie, gdy tylko ${many ? "będą gotowe" : "będzie gotowy"}. Gdyby chcieli Państwo, żebym resztę wysłała wcześniej, proszę napisać.`,
    noun: (c) => (c ? "Zamówienie indywidualne" : "Zamówienie"),
    product: "Wyrób",
    originalDate: "Pierwotny termin",
    newDate: "Nowy termin",
    reason: "Przyczyna",
    note: "Lepiej starannie niż szybko — dziękuję, że dają mi Państwo ten czas.",
    compensation: (o) => `W podziękowaniu za cierpliwość przygotowałam dla Państwa: ${o}.`,
    track: "Śledź zamówienie",
    viewOrder: "Zobacz zamówienie",
    questions: "W razie jakichkolwiek pytań proszę pisać na",
    closing: "Dziękuję za cierpliwość",
    soon: "wkrótce",
  },
  de: {
    preview: (c, n) =>
      `${c ? "Ihre Auftragsarbeit" : "Ihre Bestellung"} ${n} verzögert sich – es tut mir leid, danke für Ihre Geduld.`,
    eyebrow: (c, n) => `${c ? "Auftragsarbeit" : "Bestellung"} ${n}`,
    title: "Es tut mir leid –",
    accent: (c) => `${c ? "Ihre Auftragsarbeit" : "Ihre Bestellung"} verzögert sich.`,
    intro: (c, n) =>
      `es tut mir leid – ${c ? "Ihre Auftragsarbeit" : "Ihre Bestellung"} ${n} verzögert sich. Handarbeit hat ihren eigenen Rhythmus, und diesmal hat sie mehr Zeit gebraucht, als ich eingeplant hatte. Den neuen Termin finden Sie unten; falls er Ihnen nicht passt, schreiben Sie mir, und wir besprechen, wie es weitergeht.`,
    stillMakingOne: "Dieses Stück stelle ich gerade noch fertig:",
    stillMakingMany: "Diese Stücke stelle ich gerade noch fertig:",
    sendWhole: (many) =>
      `Ich schicke Ihnen die Bestellung vollständig, sobald ${many ? "sie fertig sind" : "es fertig ist"}. Wenn Sie den Rest lieber schon früher erhalten möchten, schreiben Sie mir.`,
    noun: (c) => (c ? "Auftragsarbeit" : "Bestellung"),
    product: "Artikel",
    originalDate: "Ursprünglicher Termin",
    newDate: "Neuer Termin",
    reason: "Grund",
    note: "Lieber gründlich als schnell – danke, dass Sie mir die Zeit geben.",
    compensation: (o) => `Als Dankeschön für Ihre Geduld habe ich für Sie vorbereitet: ${o}.`,
    track: "Bestellung verfolgen",
    viewOrder: "Bestellung ansehen",
    questions: "Wenn Sie etwas wissen möchten, schreiben Sie mir an",
    closing: "Danke für Ihre Geduld und herzliche Grüße",
    soon: "in Kürze",
  },
  en: {
    preview: (c, n) =>
      `Your ${c ? "commission" : "order"} ${n} will be delayed — I'm sorry, and thank you for your patience.`,
    eyebrow: (c, n) => `${c ? "Commission" : "Order"} ${n}`,
    title: "I'm sorry —",
    accent: (c) => `your ${c ? "commission" : "order"} will be delayed.`,
    intro: (c, n) =>
      `I'm sorry — your ${c ? "commission" : "order"} ${n} will be delayed. Handmade work has its own rhythm, and this time it has needed more time than I had planned. You'll find the new date below; if it doesn't suit you, just write to me and we'll agree on what to do next.`,
    stillMakingOne: "I'm still finishing this piece:",
    stillMakingMany: "I'm still finishing these pieces:",
    sendWhole: (many) =>
      `I'll send you the whole order as soon as ${many ? "they are" : "it is"} ready. If you'd like the rest sent earlier, just write to me.`,
    noun: (c) => (c ? "Commission" : "Order"),
    product: "Piece",
    originalDate: "Original date",
    newDate: "New date",
    reason: "Reason",
    note: "Better done well than done fast — thank you for giving me the time.",
    compensation: (o) => `As a thank-you for your patience, I've prepared this for you: ${o}.`,
    track: "Track order",
    viewOrder: "View order",
    questions: "If there's anything you'd like to know, just write to me at",
    closing: "Thank you for your patience,",
    soon: "very soon",
  },
}

interface OrderDelayedEmailProps {
  customerName?: string;
  orderNumber?: string;
  originalDeliveryDate?: string;
  newDeliveryDate?: string;
  delayReason?: string;
  compensationOffer?: string;
  trackingLink?: string;
  orderLink?: string;
  supportEmail?: string;
  /** Výrobky, které se dodělávají a kvůli kterým se objednávka zdrží („Hrnek · 2 ks"). */
  delayedItems?: string[];
  /** Zdrží se celá objednávka (všechny výrobky), ne jen část. */
  wholeOrder?: boolean;
  /** Zpoždění zakázky (smluvní termín výroby) — „zakázka", ne „objednávka". */
  isCommission?: boolean;
}

/**
 * Původní termín, kompenzace a sledovací odkaz se vykreslí jen s reálnými
 * daty — výchozí hodnota, která slibuje kupón nebo termín, jenž nikdy nebyl
 * domluvený, by byla slibem, který nikdo nedal.
 */
function OrderDelayedEmailComponent({
  customerName,
  orderNumber = "",
  originalDeliveryDate,
  newDeliveryDate,
  delayReason,
  compensationOffer,
  trackingLink,
  orderLink = "",
  supportEmail = CONTACT_EMAIL,
  delayedItems,
  wholeOrder = false,
  isCommission = false,
}: OrderDelayedEmailProps) {
  const t = useCopy(COPY)
  const orderUrl = orderLink || storeLink()
  const items = delayedItems ?? []
  return (
    <EmailLayout preview={t.preview(isCommission, orderNumber)}>
      <Eyebrow>{t.eyebrow(isCommission, orderNumber)}</Eyebrow>
      <EmailH1 accent={t.accent(isCommission)}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(isCommission, orderNumber)}</P>

      {items.length && !isCommission ? (
        <>
          <P>{items.length === 1 ? t.stillMakingOne : t.stillMakingMany}</P>
          <ul style={{ margin: "0 0 16px", paddingLeft: "20px", color: brand.body, fontFamily: brand.sans, fontSize: "15px", lineHeight: "24px" }}>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {!wholeOrder ? <P>{t.sendWhole(items.length !== 1)}</P> : null}
        </>
      ) : null}

      {orderNumber ? <LedgerRow label={t.noun(isCommission)} value={orderNumber} /> : null}
      {isCommission && items.length ? <LedgerRow label={t.product} value={items.join(", ")} /> : null}
      {originalDeliveryDate ? (
        <LedgerRow label={t.originalDate} value={originalDeliveryDate} />
      ) : null}
      <LedgerRow label={t.newDate} value={newDeliveryDate || t.soon} strong />
      {delayReason ? <LedgerRow label={t.reason} value={delayReason} /> : null}
      <LedgerEnd />

      <Note tone="clay">{t.note}</Note>

      {compensationOffer ? <P>{t.compensation(compensationOffer)}</P> : null}

      <ButtonRow>
        {trackingLink ? (
          <>
            <EmailButton href={trackingLink}>{t.track}</EmailButton>
            {orderUrl ? (
              <>
                <span style={{ display: "inline-block", width: "12px" }} />
                <EmailButton href={orderUrl} variant="ghost">
                  {t.viewOrder}
                </EmailButton>
              </>
            ) : null}
          </>
        ) : orderUrl ? (
          <EmailButton href={orderUrl}>{t.viewOrder}</EmailButton>
        ) : null}
      </ButtonRow>

      <P small>
        {t.questions}{" "}
        <Link
          href={`mailto:${supportEmail}`}
          style={{ color: brand.ink, textDecoration: "underline" }}
        >
          {supportEmail}
        </Link>
        .
      </P>
      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const OrderDelayedEmail = (props: OrderDelayedEmailProps) => (
  <OrderDelayedEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderDelayed: OrderDelayedEmailProps = {
  customerName: "Marie Svobodová",
  orderNumber: "#12345",
  originalDeliveryDate: "15. 10. 2026",
  newDeliveryDate: "22. 10. 2026",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  supportEmail: "info@keramickazahrada.cz",
  delayedItems: ["Pítko pro ptáky — List velký 44 cm", "Vlčí mák červeno oranžový · 3 ks"],
  wholeOrder: false,
}

export default () => <OrderDelayedEmailComponent {...mockOrderDelayed} />
